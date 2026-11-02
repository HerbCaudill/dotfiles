---
name: prepare-for-feedback
description: Use when Herb wants to review or record feedback on VibeResults next to DevResults. Starts both sites on the mini with the loura instance, tunnels them to the Mac, and opens them side by side.
---

# Prepare for feedback

Herb compares VibeResults with DevResults on the design refresh branch, usually on the Mac. Both sites run on the mini.

Run this from the Mac or the mini:

```sh
node --experimental-strip-types ~/.claude/skills/prepare-for-feedback/scripts/run.ts
```

Options:

- `--instance <subdomain>` opens another instance. The default is `loura`.
- `--environment <id>` serves DevResults from another `drenv` environment on the mini. The default is `compare-design-refresh`.
- `--no-open` skips the browser windows.

The script can take several minutes on a cold start, so run it in the background and wait for it to finish. It is safe to rerun, because it reuses whatever is already working:

1. On the mini, it starts the primary DevResults site, the `VibeResults dev` task and the environment, but only if nothing is listening on their ports. It never creates, syncs or resets the environment.
2. On the Mac, it reloads `devlocal-mini-tunnel` if `127.0.0.2` is missing. Launchd can leave that service stuck after a reboot, and restarting it with `kickstart` hangs. This opens a Terminal window where Herb approves `sudo`, so tell him before you run it if you can.
3. It forwards the environment's port on `127.0.0.2` and port 9443 on `127.0.0.1`. It reuses SSH forwards with the same destination and stops with an error if another process holds a port.
4. It checks both sites from the Mac, then opens two Chrome windows: VibeResults on the left and DevResults on the right.

VibeResults uses its own backend, the primary DevResults site on `main`, so only the DevResults window shows the design refresh branch.

## Report

Give Herb both URLs and say which sites had to be started. The script prints `commitsBehind`; if it isn't 0, say the DevResults site is that many commits behind its branch. Don't sync the environment unless Herb asks, because that means a rebuild and restart. If a step fails, report the error. Don't fall back to another environment or site.

## After the session

The sites can stay running. To stop the forwards, run this on the Mac:

```sh
pkill -f "ssh -fN .*-L 127.0.0.[12]:"
```

Use the `video-feedback` skill to turn a recording into tasks.
