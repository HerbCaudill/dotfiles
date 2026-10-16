param(
  [string]$RepoRoot = "C:\Code\HerbCaudill\dotfiles",
  [int]$IntervalMinutes = 15
)

$ErrorActionPreference = "Stop"
$pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"
$script = Join-Path $RepoRoot "scripts\windows\sync-agent-transcripts.ps1"
if (-not (Test-Path -LiteralPath $pwsh)) { throw "PowerShell 7 not found at $pwsh" }
if (-not (Test-Path -LiteralPath $script)) { throw "Transcript sync script not found at $script" }
$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -RepoRoot `"$RepoRoot`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName "agent-transcripts-sync" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered transcript sync every $IntervalMinutes minutes; log: $env:LOCALAPPDATA\agent-transcripts-sync.log"
