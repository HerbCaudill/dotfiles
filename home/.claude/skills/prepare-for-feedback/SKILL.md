---
name: prepare-for-feedback
description: Use when Herb wants to review or record feedback on VibeResults next to DevResults. Serves both from the MacBook – DevResults from the Parallels VM and VibeResults from a local dev server on main – with the loura instance, and opens them side by side.
---

# Prepare for feedback

Herb compares VibeResults with DevResults on the MacBook. Both sites run there, so the session doesn't depend on the mini: DevResults runs in the Parallels VM, and VibeResults runs as a dev server on the Mac that uses the VM as its backend. Both show the VM's copy of the data.

Run this on the Mac:

```sh
node --experimental-strip-types ~/.claude/skills/prepare-for-feedback/scripts/run.ts
```

Options:

- `--instance <subdomain>` opens another instance. The default is `loura`.
- `--no-open` skips the browser windows.

The script can take several minutes, especially on a cold VM or the first run, so run it in the background and wait for it to finish. It is safe to rerun, because it reuses whatever is already working:

1. It starts or resumes the `Windows 11` VM if needed and waits for SSH to `devresults-vm`.
2. In the VM, it starts SQL Server if it's stopped, and runs the `DevResults Local Services` task (Azurite and IIS Express) if nothing listens on port 443. It never builds or changes the VM's `C:\Code\DevResults` checkout.
3. It reloads `devlocal-mini-tunnel` if the Mac's `127.0.0.2` loopback address is missing, because `*.devlocal.us` resolves there. Launchd can leave that service stuck after a reboot, and restarting it with `kickstart` hangs. This opens a Terminal window where Herb approves `sudo`, so tell him before you run it if you can.
4. It forwards `127.0.0.2:8443` on the Mac to the VM's port 443, so DevResults opens at `https://<instance>.devlocal.us:8443`. Port 443 on that address stays with the mini's primary site. It reuses an SSH forward to the VM and stops with an error if another process holds the port.
5. It keeps a dedicated worktree, `~/Code/DevResults/devresults-next-feedback`, detached at `origin/main`. It creates the worktree on the first run, and moves it to `origin/main` when it falls behind, restarting its dev server. It stops with an error if the worktree has local changes. The dev server runs on the worktree's own port with `DEVRESULTS_ORIGIN=https://10.211.55.3`, so VibeResults opens at `https://<instance>.devresultsnext.localhost:<port>`. A separate worktree keeps it from sharing Vite's cache with Herb's own `pnpm dev`, which can keep running against the mini on port 9443.
6. It checks both sites from the Mac, including that VibeResults reaches the VM's API, then opens two Chrome windows: VibeResults on the left and DevResults on the right.

The VM's `loura` is its own load. It can drift from the mini's; to reload it, follow the loader instructions in `data/loura/README.md` in devresults-next, aimed at the VM's database.

Browsers share cookies across ports on one host, so a sign-in to `loura.devlocal.us:8443` (the VM) and to `loura.devlocal.us` (the mini) replace each other.

## Report

Give Herb both URLs and say what had to be started. The script prints:

- `vibeResultsRevision`, and `vibeResultsUpdated` when it created or moved the worktree this run.
- `devResultsBranch`, `devResultsRevision` and `devResultsCommitsBehind`, from the VM's checkout. If the branch isn't `main`, say so. If `devResultsCommitsBehind` isn't 0, say the DevResults site is that many commits behind main. Don't pull or rebuild in the VM unless Herb asks, because the VM's checkout is shared with `dr` and `drsync` and a rebuild takes a while.

If a step fails, report the error. Don't fall back to the mini or another site.

## After the session

The sites can stay running, but the VM uses a lot of the MacBook's memory. To free it, run these on the Mac:

```sh
pkill -f "ssh -fN .*-L 127.0.0.2:8443:"
pkill -f "devresults-next-feedback/apps/web/node_modules"
prlctl suspend "Windows 11"
```

Use the `video-feedback` skill to turn a recording into tasks.
