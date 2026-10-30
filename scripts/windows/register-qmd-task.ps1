param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$node = (& mise.exe which node).Trim()
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $node)) { throw 'Node runtime not found' }
$runner = Join-Path $RepoRoot 'scripts/windows/run-qmd.ps1'
$action = New-ScheduledTaskAction -Execute 'C:\Program Files\PowerShell\7\pwsh.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Node `"$node`""
$trigger = New-ScheduledTaskTrigger -Daily -At '09:00'
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
# The runner enforces an absolute 06:00 cutoff too, including delayed starts.
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 21) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'qmd-refresh' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host 'Registered daily 09:00 qmd-refresh; log: ~/.local/state/qmd/refresh.log'
