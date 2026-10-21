param(
  [string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles',
  [int]$Port = 9223
)

$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profileRoot = Join-Path $env:LOCALAPPDATA 'AgentChrome'
$profile = Join-Path $profileRoot 'User Data'
$arguments = "--user-data-dir=`"$profile`" --remote-debugging-address=127.0.0.1 --remote-debugging-port=$Port --no-first-run --no-default-browser-check about:blank"
if (-not (Test-Path -LiteralPath $chrome)) { throw 'Google Chrome is not installed.' }
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose an unprivileged TCP port.' }

$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($listener) {
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener[0].OwningProcess)"
  if ($owner.Name -ne 'chrome.exe' -or $owner.CommandLine -notlike "*--user-data-dir=`"$profile`"*") {
    throw 'The requested debugging port is already owned by another process.'
  }
}

if (-not (Test-Path -LiteralPath $profileRoot)) {
  New-Item -ItemType Directory -Path $profileRoot | Out-Null
  $acl = Get-Acl -LiteralPath $profileRoot
  $acl.SetOwner([Security.Principal.WindowsIdentity]::GetCurrent().User)
  [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($profileRoot), $acl)
}
$env:AGENT_PRIVATE_DIRECTORY = $profileRoot
& (Join-Path $RepoRoot 'scripts\windows\private-directory.ps1')

$action = New-ScheduledTaskAction -Execute $chrome -Argument $arguments
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $principal.UserId
$trigger.Delay = 'PT10S'
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$existing = Get-ScheduledTask -TaskName 'Agent Chrome' -ErrorAction SilentlyContinue
if ($existing.State -eq 'Running' -and $existing.Actions.Arguments -ne $arguments) {
  throw 'Close Agent Chrome before changing its launch configuration.'
}
Register-ScheduledTask -TaskName 'Agent Chrome' -Action $action -Principal $principal -Trigger $trigger -Settings $settings -Force | Out-Null

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Programs')) 'Agent Chrome.lnk'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath = $chrome
$shortcut.Arguments = $arguments
$shortcut.IconLocation = "$chrome,0"
$shortcut.Description = 'Persistent Chrome profile for local agent automation'
$shortcut.Save()
if (-not $listener) { Start-ScheduledTask -TaskName 'Agent Chrome' }
Write-Output "Agent Chrome uses $profile and http://127.0.0.1:$Port. Starts at user sign-in; its profile is separate from regular Chrome."
