{ lib, ... }:
{
  # Exposes this Mac's T3 on the tailnet for the mini, and gives Claude here the mini's T3 tools.
  # Signing in (`claude mcp login t3-mini`) stays a manual step; see the mini skill.
  home.activation.t3Bridge = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    tailscale=/usr/local/bin/tailscale
    if [ -x "$tailscale" ] && ! "$tailscale" serve status --json 2>/dev/null | /usr/bin/grep -q '127.0.0.1:3773'; then
      run "$tailscale" serve --bg 3773
    fi

    claude="$HOME/.local/bin/claude"
    if [ -x "$claude" ] && ! "$claude" mcp get t3-mini >/dev/null 2>&1; then
      run "$claude" mcp add --scope user --transport http t3-mini https://mini.tailcf8536.ts.net/mcp
      echo "Added the t3-mini MCP server; sign in with: claude mcp login t3-mini"
    fi
  '';
}
