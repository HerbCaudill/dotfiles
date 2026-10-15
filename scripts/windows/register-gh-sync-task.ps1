param(
  [string]$RepoRoot = "C:\Code\HerbCaudill\dotfiles",
  [int]$IntervalMinutes = 15
)

# Registers a scheduled task that runs home/.local/bin/gh-sync through Git Bash every
# $IntervalMinutes, matching the macOS launchd agent. Run from an elevated shell: S4U lets the task
# run while nobody is signed in, without storing a password. S4U tasks cannot read Windows
# Credential Manager, so sign in to GitHub with `gh auth login --insecure-storage` and run
# `gh auth setup-git` first. Logs go to %LOCALAPPDATA%\gh-sync.log.

$ErrorActionPreference = "Stop"

$bash = "C:\Program Files\Git\bin\bash.exe"
$script = (Join-Path $RepoRoot "home\.local\bin\gh-sync") -replace "\\", "/"
$log = (Join-Path $env:LOCALAPPDATA "gh-sync.log") -replace "\\", "/"

if (-not (Test-Path -LiteralPath $bash)) { throw "Git Bash not found at $bash" }
if (-not (Test-Path -LiteralPath $script)) { throw "gh-sync not found at $script" }

$action = New-ScheduledTaskAction -Execute $bash -Argument "-lc `"'$script' >> '$log' 2>&1`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName "gh-sync" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered gh-sync to run every $IntervalMinutes minutes; log: $log"
