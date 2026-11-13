---
name: show-me
description: 'Use when Herb says "show me" (or "let me see it") about something just changed: screenshot the changed route, page or story, show the screenshots inline, and open it in his browser.'
---

# Show me

"Show me" means two things: show screenshots of the thing you just changed in the reply, and open it in Herb's browser so he can look at it himself. Do not describe what it looks like in place of either.

1. **Pick the most specific URL.** Use the route, page, Storybook story or file that the change affects. Include the query string, hash or story ID that lands on the changed state. If the change touched several, open the one the work was about; add more only when each shows something different.
2. **Make sure a server is serving the changed code.** A server running an older checkout does not count. Prefer a server already running from the checkout that has the change. Otherwise start one from that checkout as a detached process with no time limit (for example, `nohup pnpm storybook > /tmp/<repo>-storybook.log 2>&1 &`), using a free port so you do not disturb anyone else's server. Wait until it responds.
3. **Take screenshots.** Use headless Playwright, preferring the repo's own version (for example, `pnpm exec playwright screenshot --wait-for-timeout 1000 <url> <file>.png`, or a short script when the state needs clicks or sign-in to reach). If it says its browser is missing, run `playwright install chromium` with that same version and retry. Save them in your scratchpad directory. Capture the changed state, not just the page's first view. If the change affects layout on phones, add a phone-width shot. If you captured a before screenshot while doing the work, show it alongside the after. Look at each image before you show it; retake it if it shows a loading spinner, an error or the wrong state.
4. **Open it** with `open <url>` on macOS. Do not use browser-control tools for this.
5. **Reply briefly:** embed each screenshot as a full-size Markdown image with its absolute path, labeled in a few words. Then give the URL, which checkout it is serving, and how to stop any server you started. If a state needs a manual step to reach in the browser (signing in, waiting for a slow load, flipping a control), say so.

If the work ran on the mini, serve it there and tunnel the port back to the MacBook as the `mini` skill describes. Take the screenshots against the MacBook URL, then open it.
