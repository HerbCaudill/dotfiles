# Install the email-processing launcher on the mini and schedule its two jobs: the hourly run and the
# daily step that turns proposals into Tasks Inbox items before the morning briefing. The hourly run is
# log-only unless -Archive is given; switch archiving on only after Herb has reviewed the log-only results.
param(
  [string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles',
  [switch]$Archive
)
$ErrorActionPreference = 'Stop'
$pwsh = 'C:\Program Files\PowerShell\7\pwsh.exe'
$runner = Join-Path $RepoRoot 'scripts\windows\run-email-processing.ps1'
$entry = Join-Path $RepoRoot 'home\.local\bin\email-processing'
if (-not (Test-Path -LiteralPath $pwsh)) { throw "PowerShell 7 not found at $pwsh" }
if (-not (Test-Path -LiteralPath $runner) -or -not (Test-Path -LiteralPath $entry)) { throw 'Dotfiles checkout not found' }

# A launcher so agents on the mini can run `email-processing approve ...` like on the Mac.
$node = Join-Path $env:LOCALAPPDATA 'mise\shims\node.exe'
$bin = Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Path $bin -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $bin 'email-processing.cmd'), "@echo off`r`n`"$node`" `"$entry`" %*`r`n", [Text.UTF8Encoding]::new($false))

$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Register one task that runs an email-processing command.
function Register-EmailTask([string]$Name, $Trigger, [string]$Command) {
  $action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runner`" -RepoRoot `"$RepoRoot`" $Command"
  Register-ScheduledTask -TaskName $Name -Action $action -Trigger $Trigger -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
}

# Hourly from 07:00 to 23:00.
$hourly = New-ScheduledTaskTrigger -Daily -At '07:00'
$hourly.Repetition = (New-ScheduledTaskTrigger -Once -At '07:00' -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 16 -Minutes 5)).Repetition
$runCommand = if ($Archive) { 'run' } else { 'run --log-only' }
Register-EmailTask 'email-processing' $hourly $runCommand
Register-EmailTask 'email-processing-propose' (New-ScheduledTaskTrigger -Daily -At '06:30') 'propose'

$mode = if ($Archive) { 'archiving' } else { 'log-only' }
Write-Host "Registered email-processing hourly 07:00-23:00 ($mode) and email-processing-propose daily at 06:30; log: $env:LOCALAPPDATA\email-processing.log"
