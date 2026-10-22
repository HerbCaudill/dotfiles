param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$apps = @(
  @{Name='T3 desktop'; Path='Programs\t3code\T3 Code (Nightly).exe'},
  @{Name='Obsidian desktop'; Path='Programs\Obsidian\Obsidian.exe'},
  @{Name='Signal desktop'; Path='Programs\signal-desktop\Signal.exe'}
)
foreach ($app in $apps) {
  $path = Join-Path $env:LOCALAPPDATA $app.Path
  if (-not (Test-Path -LiteralPath $path)) { throw "Install $($app.Name) first." }
  $action = New-ScheduledTaskAction -Execute $path
  Register-ScheduledTask -TaskName $app.Name -Action $action -Principal $principal -Settings $settings -Force | Out-Null
}
foreach ($relative in @('.local\state\morning-briefing', '.local\state\morning-briefing\mac-sources', '.local\state\inbox-processing')) {
  $path = Join-Path $env:USERPROFILE $relative
  New-Item -ItemType Directory -Path $path -Force | Out-Null
  $acl = Get-Acl -LiteralPath $path
  $acl.SetOwner([Security.Principal.WindowsIdentity]::GetCurrent().User)
  [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($path), $acl)
  $env:AGENT_PRIVATE_DIRECTORY = $path
  & (Join-Path $RepoRoot 'scripts\windows\private-directory.ps1')
}
Write-Output 'Installed interactive desktop launchers and private briefing state. No briefing or inbox schedule is enabled.'
