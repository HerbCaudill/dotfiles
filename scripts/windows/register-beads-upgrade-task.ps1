param(
  [string]$At = "04:00"
)

# Registers a scheduled task that upgrades beads (`bd`) through winget daily and at sign-in, so the
# mini keeps up with new releases without anyone remembering to. Only the beads package is
# upgraded; a blanket `winget upgrade --all` could restart SQL Server or Visual Studio mid-run.
# winget needs an interactive user session, so the task runs as the signed-in user rather than
# S4U. Logs go to %LOCALAPPDATA%\beads-upgrade.log.

$ErrorActionPreference = "Stop"

$winget = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winget.exe"
$log = Join-Path $env:LOCALAPPDATA "beads-upgrade.log"

if (-not (Test-Path -LiteralPath $winget)) { throw "winget not found at $winget" }

$command = "& '$winget' upgrade --id GasTownHall.Beads --exact --scope user --silent --accept-source-agreements --accept-package-agreements --disable-interactivity *>> '$log'"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$command`""
$triggers = @(
  New-ScheduledTaskTrigger -Daily -At $At
  New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -StartWhenAvailable -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName "beads-upgrade" -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered beads-upgrade to run daily at $At and at sign-in; log: $log"
