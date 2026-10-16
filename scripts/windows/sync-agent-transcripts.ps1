param([string]$RepoRoot = "C:\Code\HerbCaudill\dotfiles")

$ErrorActionPreference = "Stop"
$env:Path = "$env:LOCALAPPDATA\mise\shims;" + [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
$log = Join-Path $env:LOCALAPPDATA "agent-transcripts-sync.log"
$nodeRoot = Join-Path $env:LOCALAPPDATA "mise\installs\node"
$node = Get-ChildItem -LiteralPath $nodeRoot -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' -and [version]$_.Name -ge [version]'22.18.0' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName "node.exe" }
if (-not $node -or -not (Test-Path -LiteralPath $node)) { throw "Install Node.js 22.18 or newer with mise before syncing transcripts" }
& $node (Join-Path $RepoRoot "home\.local\bin\agent-transcripts-sync") >> $log 2>&1
if ($LASTEXITCODE -ne 0) { throw "Transcript sync failed; see $log" }
