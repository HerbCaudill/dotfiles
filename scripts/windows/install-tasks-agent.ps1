param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles', [switch]$AutoStart, [ValidateSet('Interactive','S4U')][string]$PeerLogonType = 'Interactive')
$ErrorActionPreference = 'Stop'
$env:Path = "$env:USERPROFILE\AppData\Local\mise\shims;" + $env:Path
$node = (& mise which node).Trim()
if ((& $node --version) -notlike 'v24.*') { throw 'Tasks requires Node 24.' }
$bin = Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Path $bin -Force | Out-Null
foreach ($entry in @(@{Name='tasks'; Source='windowsCli.ts'}, @{Name='tasks-agent'; Source='windowsMain.ts'})) {
  $source = Join-Path $RepoRoot "scripts\tasks-agent\$($entry.Source)"
  Set-Content -LiteralPath (Join-Path $bin "$($entry.Name).cmd") -Encoding ascii -Value '@echo off', "`"$node`" `"$source`" %*"
}
$pwsh = 'C:\Program Files\PowerShell\7\pwsh.exe'
$runner = Join-Path $RepoRoot 'scripts\windows\run-tasks-agent.ps1'
$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runner`" -RepoRoot `"$RepoRoot`""
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType $PeerLogonType -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$arguments = @{TaskName='tasks-agent'; Action=$action; Principal=$principal; Settings=$settings; Force=$true}
if ($AutoStart) {
  $arguments.Trigger = @(New-ScheduledTaskTrigger -AtLogOn -User $principal.UserId)
  if ($PeerLogonType -eq 'S4U') { $arguments.Trigger += New-ScheduledTaskTrigger -AtStartup }
}
if ((Get-ScheduledTask -TaskName tasks-agent -ErrorAction SilentlyContinue).State -eq 'Running') {
  throw 'Stop the Tasks peer and verify released ownership before changing its supervisor.'
}
Register-ScheduledTask @arguments | Out-Null
Write-Output "Installed Tasks launchers and $PeerLogonType supervisor. Automatic startup: $AutoStart. Verify enrollment and tasks status before enabling automatic startup."
