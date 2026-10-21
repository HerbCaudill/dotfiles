# Mini only. Exposes this machine's T3 on the tailnet for the Mac, and gives Claude here the Mac's T3 tools.
# Signing in (`claude mcp login t3-mac`) stays a manual step; see the mini skill.

$ErrorActionPreference = "Stop"

$tailscale = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if ($tailscale -and -not ((& $tailscale serve status --json | Out-String) -match "127\.0\.0\.1:3773")) {
  & $tailscale serve --bg 3773 | Out-Null
  Write-Host "Started tailscale serve for T3 on port 3773"
}

$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if ($claude) {
  & $claude mcp get t3-mac *> $null
  if ($LASTEXITCODE -ne 0) {
    & $claude mcp add --scope user --transport http t3-mac https://herbs-macbook-pro.tailcf8536.ts.net/mcp | Out-Null
    Write-Host "Added the t3-mac MCP server; sign in with: claude mcp login t3-mac"
  }
}
