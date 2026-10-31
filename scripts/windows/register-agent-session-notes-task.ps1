param([string]$RepoRoot = "C:\Code\HerbCaudill\dotfiles")

$ErrorActionPreference = "Stop"
$pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"
$script = Join-Path $RepoRoot "scripts\windows\run-agent-session-notes.ps1"
if (-not (Test-Path -LiteralPath $pwsh)) { throw "PowerShell 7 not found at $pwsh" }
if (-not (Test-Path -LiteralPath $script)) { throw "Session note script not found at $script" }
$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -RepoRoot `"$RepoRoot`""
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName "agent-session-notes" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered daily 02:00 agent-session-notes; log: $env:LOCALAPPDATA\agent-session-notes.log"
