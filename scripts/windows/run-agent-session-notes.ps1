param(
  [string]$RepoRoot = "C:\Code\HerbCaudill\dotfiles",
  [string]$Vault = "C:\Code\HerbCaudill\notes"
)

$ErrorActionPreference = "Stop"
$log = Join-Path $env:LOCALAPPDATA "agent-session-notes.log"
$nodeRoot = Join-Path $env:LOCALAPPDATA "mise\installs\node"
$node = Get-ChildItem -LiteralPath $nodeRoot -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' -and [version]$_.Name -ge [version]'22.18.0' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName "node.exe" }
if (-not $node -or -not (Test-Path -LiteralPath $node)) { throw "Install Node.js 22.18 or newer with mise before exporting session notes" }
$env:AGENT_SESSION_NOTES_VAULT = $Vault
& $node (Join-Path $RepoRoot "scripts\agent-session-notes\runAgentSessionNotes.ts") >> $log 2>&1
if ($LASTEXITCODE -ne 0) { throw "Session note export failed; see $log" }
