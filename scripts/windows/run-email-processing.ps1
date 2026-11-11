# Run one email-processing command and append its output to the job log.
param(
  [string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles',
  [Parameter(ValueFromRemainingArguments)][string[]]$Arguments
)
$ErrorActionPreference = 'Stop'
$nodeRoot = Join-Path $env:LOCALAPPDATA 'mise\installs\node'
$node = Get-ChildItem -LiteralPath $nodeRoot -Directory |
  Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' -and [version]$_.Name -ge [version]'24.0.0' } |
  Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 |
  ForEach-Object { Join-Path $_.FullName 'node.exe' }
if (-not $node -or -not (Test-Path -LiteralPath $node)) { throw 'Install Node.js 24 with mise before running email-processing' }
$log = Join-Path $env:LOCALAPPDATA 'email-processing.log'
"[$((Get-Date).ToString('s'))] email-processing $($Arguments -join ' ')" | Add-Content -LiteralPath $log
& $node (Join-Path $RepoRoot 'home\.local\bin\email-processing') @Arguments *>> $log
exit $LASTEXITCODE
