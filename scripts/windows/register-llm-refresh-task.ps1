param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$node = (& mise.exe which node).Trim()
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $node)) { throw 'Node runtime not found' }
$bin = Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Force $bin | Out-Null
Set-Content -LiteralPath (Join-Path $bin 'llm.cmd') -Encoding ascii -Value "@`"$node`" --no-warnings `"$RepoRoot\scripts\llm\cli.ts`" %*"
$runner = Join-Path $RepoRoot 'scripts/windows/run-llm-refresh.ps1'
$action = New-ScheduledTaskAction -Execute 'C:\Program Files\PowerShell\7\pwsh.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Node `"$node`""
$trigger = New-ScheduledTaskTrigger -Daily -At '03:30'
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'llm-refresh' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host 'Registered daily 03:30 llm-refresh; log: ~/.local/state/llm/refresh.log'
