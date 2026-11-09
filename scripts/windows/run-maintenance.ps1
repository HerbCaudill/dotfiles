param(
  [Parameter(Mandatory)][string]$Node,
  [Parameter(Mandatory)][ValidateSet('prepare', 'resume')][string]$Command
)
$ErrorActionPreference = 'Stop'
$state = Join-Path $env:USERPROFILE '.local/state/mini-maintenance'
New-Item -ItemType Directory -Force $state | Out-Null
$env:Path = (Split-Path $Node) + ';' + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
& $Node --experimental-strip-types --disable-warning=ExperimentalWarning (Join-Path $PSScriptRoot '../maintenance/restart.ts') $Command *>> (Join-Path $state 'maintenance.log')
exit $LASTEXITCODE
