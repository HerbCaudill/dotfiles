param([string]$BriefingsRoot = 'C:/Code/HerbCaudill/leo', [switch]$EnableSchedules)
$ErrorActionPreference = 'Stop'
$runner = Join-Path $BriefingsRoot 'scripts/windows/runBriefingJob.ps1'
if (-not (Test-Path -LiteralPath $runner)) { throw 'Briefing runner is missing.' }
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
foreach ($job in @(
  @{Name='Morning briefing'; Key='morning'; Interactive=$true},
  @{Name='Inbox intake'; Key='inbox'; Interactive=$false},
  @{Name='Inbox research'; Key='research'; Interactive=$false},
  @{Name='Leo heartbeat'; Key='heartbeat'; Interactive=$false}
)) {
  $logon = if ($job.Interactive) { 'Interactive' } else { 'S4U' }
  $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType $logon -RunLevel Limited
  $action = New-ScheduledTaskAction -Execute 'C:/Program Files/PowerShell/7/pwsh.exe' -Argument "-NoProfile -File `"$runner`" -Job $($job.Key)" -WorkingDirectory $BriefingsRoot
  $registration = @{TaskName=$job.Name; Action=$action; Principal=$principal; Settings=$settings; Force=$true}
  if ($EnableSchedules -and $job.Key -eq 'morning') { $registration.Trigger = New-ScheduledTaskTrigger -Daily -At '07:00' }
  if ($EnableSchedules -and $job.Key -eq 'inbox') { $registration.Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddHours(1) -RepetitionInterval (New-TimeSpan -Hours 1) }
  if ($EnableSchedules -and $job.Key -eq 'heartbeat') { $registration.Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 30) }
  Register-ScheduledTask @registration | Out-Null
}
Write-Output "Installed briefing jobs. Automatic schedules enabled: $EnableSchedules"
