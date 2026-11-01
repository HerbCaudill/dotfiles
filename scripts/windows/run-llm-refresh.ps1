param([Parameter(Mandatory)][string]$Node)
$ErrorActionPreference = 'Stop'
$state = Join-Path $env:USERPROFILE '.local/state/llm'
New-Item -ItemType Directory -Force $state | Out-Null
$env:Path = (Split-Path $Node) + ';' + (Join-Path $env:LOCALAPPDATA 'mise/shims') + ';' + (Join-Path $env:USERPROFILE '.local/bin') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
& $Node --no-warnings (Join-Path $PSScriptRoot '../llm/cli.ts') refresh *>> (Join-Path $state 'refresh.log')
exit $LASTEXITCODE
