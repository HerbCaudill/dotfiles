param([Parameter(Mandatory)][string]$Node)
$ErrorActionPreference = 'Stop'
$state = Join-Path $env:USERPROFILE '.local/state/qmd'
New-Item -ItemType Directory -Force $state | Out-Null
$env:Path = (Split-Path $Node) + ';' + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
& $Node --experimental-strip-types (Join-Path $PSScriptRoot '../qmd/refresh.ts') *>> (Join-Path $state 'refresh.log')
exit $LASTEXITCODE
