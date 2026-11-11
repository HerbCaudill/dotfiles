# Elevated: registers the mini's maintenance restart (nightly 02:00, acts about every 3 days) and its startup follow-up.
# See scripts/maintenance/restart.ts. Log: ~/.local/state/mini-maintenance/maintenance.log
param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$node = (& mise.exe which node).Trim()
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $node)) { throw 'Node runtime not found' }
$runner = Join-Path $RepoRoot 'scripts/windows/run-maintenance.ps1'
$pwsh = 'C:\Program Files\PowerShell\7\pwsh.exe'
# Highest run level: the job disables the heartbeat, writes the reboot log and restarts the machine.
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Highest

# No StartWhenAvailable: a missed 02:00 run must not restart the mini in the daytime.
$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Node `"$node`" -Command prepare"
$trigger = New-ScheduledTaskTrigger -Daily -At '02:00'
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'mini-maintenance-restart' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Node `"$node`" -Command resume"
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT3M'
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'mini-maintenance-resume' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

# On demand, no trigger: when Herb asks for a restart now, Start-ScheduledTask runs it outside the SSH session.
$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Node `"$node`" -Command now"
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'mini-maintenance-restart-now' -Action $action -Principal $principal -Settings $settings -Force | Out-Null

Write-Host 'Registered mini-maintenance-restart (daily 02:00), mini-maintenance-resume (startup + 3 min) and mini-maintenance-restart-now (on demand)'
