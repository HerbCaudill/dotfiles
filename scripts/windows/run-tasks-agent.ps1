param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$env:Path = "$env:USERPROFILE\AppData\Local\mise\shims;" + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$node = (& mise which node).Trim()
$state = Join-Path $env:LOCALAPPDATA 'Tasks\agent'
if (-not (Test-Path -LiteralPath $state -PathType Container)) { throw 'Prepare and select a release before starting Tasks.' }
& $node (Join-Path $RepoRoot 'scripts\tasks-agent\windowsMain.ts') serve 1>> (Join-Path $state 'stdout.log') 2>> (Join-Path $state 'stderr.log')
exit $LASTEXITCODE
