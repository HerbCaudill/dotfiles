param([string]$RepoRoot = "C:\Code\HerbCaudill\dotfiles")

$ErrorActionPreference = "Stop"
$env:Path = "$env:LOCALAPPDATA\mise\shims;" + [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
$log = Join-Path $env:LOCALAPPDATA "agent-transcripts-sync.log"
& node (Join-Path $RepoRoot "home\.local\bin\agent-transcripts-sync") >> $log 2>&1
if ($LASTEXITCODE -ne 0) { throw "Transcript sync failed; see $log" }
