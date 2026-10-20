#Requires -Version 7.3
#Requires -RunAsAdministrator
param(
  [switch]$RepairOnly
)

# Run once from an elevated PowerShell 7 shell. The protected copy runs as SYSTEM at
# startup and every five minutes; neither repairs nor Windows servicing may reboot here.
$ErrorActionPreference = "Stop"
$root = Join-Path $env:ProgramData "agent-access"
$backupData = Join-Path $root "backup"
$release = "10.0.0.0p2-Preview"
$backupBin = Join-Path $env:ProgramFiles "OpenSSH-Backup\$release"
$backupConfig = Join-Path $backupData "sshd_config"
$installedScript = Join-Path $root "setup-agent-access.ps1"
$log = Join-Path $root "watchdog.log"
$pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"

# Allow authenticated users to execute binaries, but only administrators and SYSTEM
# may change anything that the SYSTEM task or either SSH server executes.
function Initialize-ProtectedDirectory([string]$Path) {
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetSecurityDescriptorSddlForm("O:BAG:SYD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;0x1200a9;;;AU)")
  Set-Acl -LiteralPath $Path -AclObject $acl
}

# Record each repair and each healthy check with an unambiguous UTC timestamp.
function Write-RepairLog([string]$Message) {
  Write-Host "$([DateTime]::UtcNow.ToString('o')) $Message"
}

# Native tools do not throw on failure, even with ErrorActionPreference=Stop.
function Invoke-ServiceControl([string[]]$Arguments) {
  $output = & "$env:SystemRoot\System32\sc.exe" @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw "sc.exe $Arguments failed: $output" }
}

# Do not restart an already running service: existing agent sessions must survive repair.
function Repair-Service([string]$Name) {
  Set-Service -Name $Name -StartupType Automatic
  Invoke-ServiceControl -Arguments @("failure", $Name, "reset=", "86400", "actions=", "restart/15000/restart/30000/restart/60000")
  Invoke-ServiceControl -Arguments @("failureflag", $Name, "1")
  $service = Get-Service -Name $Name
  if ($service.Status -ne "Running") {
    Write-RepairLog "Starting $Name (was $($service.Status))."
    Start-Service -Name $Name
    $service.WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
  }
}

# Repair the filters as well as Enabled, so a disabled or changed rule is recoverable.
function Repair-FirewallRule([string]$Name, [int]$Port) {
  $rule = Get-NetFirewallRule -Name $Name -ErrorAction SilentlyContinue
  if (-not $rule) {
    Write-RepairLog "Creating firewall rule $Name on TCP $Port."
    New-NetFirewallRule -Name $Name -DisplayName $Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Any -Enabled True | Out-Null
  } else {
    if ($rule.Enabled -ne "True") { Write-RepairLog "Enabling firewall rule $Name." }
    $rule | Set-NetFirewallRule -Direction Inbound -Action Allow -Profile Any -Enabled True
    $rule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port -RemotePort Any
  }
}

# This ZIP install deliberately does not run install-sshd.ps1: that installer deletes
# and replaces the primary sshd service. These binaries have their own service instead.
function Repair-BackupServer {
  Initialize-ProtectedDirectory $backupData
  $sshd = Join-Path $backupBin "sshd.exe"
  if (-not (Test-Path -LiteralPath $sshd)) {
    $existing = Get-Service -Name "sshd-backup" -ErrorAction SilentlyContinue
    if ($existing -and $existing.Status -ne "Stopped") { throw "Stop sshd-backup before replacing its missing binaries." }
    Initialize-ProtectedDirectory (Split-Path $backupBin)
    Initialize-ProtectedDirectory $backupBin
    $download = Join-Path $root ([Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $download | Out-Null
    try {
      $zip = Join-Path $download "OpenSSH-Win64.zip"
      Write-RepairLog "Installing independent OpenSSH backup from Microsoft release $release."
      Invoke-WebRequest -Uri "https://github.com/PowerShell/Win32-OpenSSH/releases/download/$release/OpenSSH-Win64.zip" -OutFile $zip -TimeoutSec 180
      $expected = "23f50f3458c4c5d0b12217c6a5ddfde0137210a30fa870e98b29827f7b43aba5"
      if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $expected) { throw "OpenSSH ZIP checksum mismatch." }
      Expand-Archive -LiteralPath $zip -DestinationPath $download
      Copy-Item -Path (Join-Path $download "OpenSSH-Win64\*") -Destination $backupBin -Recurse -Force
    } finally {
      Remove-Item -LiteralPath $download -Recurse -Force
    }
  }

  $hostKey = Join-Path $backupData "ssh_host_ed25519_key"
  if (-not (Test-Path -LiteralPath $hostKey)) {
    $primaryKey = Join-Path $env:ProgramData "ssh\ssh_host_ed25519_key"
    if (Test-Path -LiteralPath $primaryKey) {
      Copy-Item -LiteralPath $primaryKey -Destination $hostKey
      Write-RepairLog "Preserved the existing host identity in the backup's own directory."
    } else {
      & (Join-Path $backupBin "ssh-keygen.exe") -q -t ed25519 -f $hostKey -N ''
      if ($LASTEXITCODE -ne 0) { throw "Backup host key generation failed." }
      Write-RepairLog "Generated backup host identity."
    }
    $acl = [Security.AccessControl.FileSecurity]::new()
    $acl.SetSecurityDescriptorSddlForm("O:BAG:SYD:P(A;;FA;;;SY)(A;;FA;;;BA)")
    Set-Acl -LiteralPath $hostKey -AclObject $acl
  }

  # Share authorized keys by reference, not a snapshot that can become stale.
  $config = @"
# Managed by setup-agent-access.ps1. Independent of the Windows optional feature.
Port 2222
HostKey $($hostKey.Replace('\', '/'))
PidFile $($backupData.Replace('\', '/'))/sshd.pid
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
AuthorizedKeysFile .ssh/authorized_keys
Subsystem sftp internal-sftp
Match Group administrators
    AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys
"@
  if (-not (Test-Path -LiteralPath $backupConfig) -or (Get-Content -LiteralPath $backupConfig -Raw).TrimEnd() -ne $config.TrimEnd()) {
    if ((Get-Service -Name "sshd-backup" -ErrorAction SilentlyContinue).Status -eq "Running") {
      throw "Stop sshd-backup before changing its config."
    }
    Set-Content -LiteralPath $backupConfig -Value $config -Encoding ascii
    Write-RepairLog "Wrote backup configuration on port 2222."
  }
  & $sshd -t -f $backupConfig
  if ($LASTEXITCODE -ne 0) { throw "Backup sshd configuration validation failed." }

  $binaryPath = "`"$sshd`" -f `"$backupConfig`""
  $service = Get-CimInstance Win32_Service -Filter "Name='sshd-backup'"
  if (-not $service) {
    New-Service -Name "sshd-backup" -DisplayName "OpenSSH backup (2222)" -BinaryPathName $binaryPath -StartupType Automatic | Out-Null
    Write-RepairLog "Registered independent sshd-backup service."
  } elseif ($service.PathName -ne $binaryPath) {
    throw "sshd-backup has an unexpected binary path: $($service.PathName)"
  }
  Repair-FirewallRule "OpenSSH-Backup-In-TCP" 2222
  Repair-Service "sshd-backup"
  Write-RepairLog "Backup sshd healthy; port 2222."
}

# Add-WindowsCapability preserves C:\ProgramData\ssh. Never remove the capability
# to repair a missing service, and never delete its configuration or authorized keys.
function Repair-WindowsServer {
  $capability = Get-WindowsCapability -Online -Name "OpenSSH.Server~~~~0.0.1.0"
  if ($capability.State -ne "Installed") {
    Write-RepairLog "OpenSSH Server capability is $($capability.State); requesting installation."
    $result = Add-WindowsCapability -Online -Name $capability.Name
    Write-RepairLog "Capability installation finished; RestartNeeded=$($result.RestartNeeded). No reboot requested."
  }
  $sshd = Join-Path $env:SystemRoot "System32\OpenSSH\sshd.exe"
  if (-not (Get-Service -Name "sshd" -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path -LiteralPath $sshd)) { throw "Windows sshd binary missing after capability installation; check DISM/CBS and pending reboot." }
    New-Service -Name "sshd" -DisplayName "OpenSSH SSH Server" -BinaryPathName "`"$sshd`"" -StartupType Automatic | Out-Null
    Write-RepairLog "Recreated missing Windows sshd service without changing C:\ProgramData\ssh."
  }
  Repair-FirewallRule "OpenSSH-Server-In-TCP" 22
  Repair-Service "sshd"
  Write-RepairLog "Windows sshd healthy; port 22."
}

Initialize-ProtectedDirectory $root
# Exclude concurrent manual setup and scheduled repairs without terminating either.
try {
  $lock = [IO.File]::Open((Join-Path $root "watchdog.lock"), 'OpenOrCreate', 'ReadWrite', 'None')
} catch [IO.IOException] {
  Write-Host "Another agent-access repair is running; leaving it in charge."
  exit 0
}

try {
  if ((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 10MB) {
    Move-Item -LiteralPath $log -Destination "$log.1" -Force
  }
  Start-Transcript -Path $log -Append | Out-Null
  try {
    Write-RepairLog "Starting repair; RepairOnly=$RepairOnly."
    if (-not $RepairOnly) {
      if (-not (Test-Path -LiteralPath $pwsh)) { throw "PowerShell 7 not found at $pwsh" }
      if ($PSCommandPath -ne $installedScript) { Copy-Item -LiteralPath $PSCommandPath -Destination $installedScript -Force }
      $action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$installedScript`" -RepairOnly"
      $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5)
      $startup = New-ScheduledTaskTrigger -AtStartup
      $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
      $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
      Register-ScheduledTask -TaskName "agent-access-watchdog" -Action $action -Trigger @($trigger, $startup) -Principal $principal -Settings $settings -Force | Out-Null
      Write-RepairLog "Registered SYSTEM watchdog at startup and every five minutes; protected script: $installedScript."
    }

    $policy = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
    New-ItemProperty -Path $policy -Name "EnableLUA" -PropertyType DWord -Value 1 -Force | Out-Null
    New-ItemProperty -Path $policy -Name "ConsentPromptBehaviorAdmin" -PropertyType DWord -Value 0 -Force | Out-Null
    Write-RepairLog "UAC enabled; administrator elevation requests approved without prompting."

    # A servicing failure must not prevent the independent backup from coming up.
    $failures = @()
    foreach ($repair in @(${function:Repair-BackupServer}, ${function:Repair-WindowsServer})) {
      try { & $repair } catch {
        Write-RepairLog "ERROR: $($_.Exception.Message)"
        $failures += $_.Exception.Message
      }
    }
    if ($failures.Count -gt 0) { throw ($failures -join '; ') }
    Write-RepairLog "Repair complete."
  } finally {
    Stop-Transcript | Out-Null
  }
} finally {
  $lock.Dispose()
}
