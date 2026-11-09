---
name: show-me
description: "Use when Herb says \"show me\" (or \"let me see it\") about something just changed: open the changed route, page or story in his browser."
---

# Show me

"Show me" means: open the thing you just changed in Herb's browser so he can look at it himself. Do not take screenshots, render previews inline, record videos or describe what it looks like.

1. **Pick the most specific URL.** Use the route, page, Storybook story or file that the change affects. Include the query string, hash or story ID that lands on the changed state. If the change touched several, open the one the work was about; open more only when each shows something different.
2. **Make sure a server is serving the changed code.** A server running an older checkout does not count. Prefer a server already running from the checkout that has the change. Otherwise start one from that checkout as a detached process with no time limit (for example, `nohup pnpm storybook > /tmp/<repo>-storybook.log 2>&1 &`), using a free port so you do not disturb anyone else's server. Wait until it responds.
3. **Open it** with `open <url>` on macOS. Do not use browser-control tools for this.
4. **Reply in a line or two:** the URL, which checkout it is serving, and how to stop any server you started. If a state needs a manual step to reach (signing in, waiting for a slow load, flipping a control), say so.

If the work ran on the mini, serve it there and tunnel the port back to the MacBook as the `mini` skill describes, then open the MacBook URL.
