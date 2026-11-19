# Elevated: registers the mini's T3 watchdog, which restarts the T3 desktop task when its server stops answering.
# See scripts/t3-watchdog/t3Watchdog.ts. Log: ~/.local/state/t3-watchdog/watchdog.log
param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$node = (& mise.exe which node).Trim()
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $node)) { throw 'Node runtime not found' }
$script = Join-Path $RepoRoot 'scripts/t3-watchdog/t3Watchdog.ts'
$pwsh = 'C:\Program Files\PowerShell\7\pwsh.exe'
# The runner is inline so the task has no extra file to keep in sync; it rebuilds PATH because S4U tasks start with a bare one.
$command = "`$s = Join-Path `$env:USERPROFILE '.local/state/t3-watchdog'; New-Item -ItemType Directory -Force `$s | Out-Null; " +
  "`$env:Path = '$(Split-Path $node);' + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); " +
  "& '$node' --experimental-strip-types --disable-warning=ExperimentalWarning '$script' *>> (Join-Path `$s 'watchdog.log')"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)
# Highest run level: the watchdog ends and starts the interactive T3 desktop task and stops its leftover processes.
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 't3-watchdog' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host 'Registered t3-watchdog (every minute)'
