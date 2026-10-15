---
name: mini
description: Use when working on or with Herb's always-on Windows mini PC (`mini`, a Minisforum) – running commands, installing software, checking scheduled tasks, syncing repos or dotfiles, or running DevResults builds and tests there. Not for the Parallels VM (`devresults-vm`).
---

# Mini (Windows mini PC)

An always-on Windows 11 Pro mini PC that hosts coding agents, especially for DevResults backend work, which needs Windows. AMD Ryzen 9 7940HS, 32 GB RAM, 1 TB SSD. Herb's account is the local administrator `MINI\herb`.

## Connecting

The machine is on Herb's tailnet as `mini`. The Mac's SSH config has a `mini` host entry, so `ssh mini` logs in with the Mac's ed25519 key.

- **SSH** uses Windows OpenSSH Server. The default shell is Windows PowerShell 5.1; `pwsh` (7) is also installed. Admin keys live in `C:\ProgramData\ssh\administrators_authorized_keys`, which must be readable only by Administrators and SYSTEM.
- **Remote Desktop** is on. Herb uses the Windows App on the Mac with the host `mini`.
- Tailscale runs unattended, so the machine stays reachable after a reboot with nobody signed in.

## Running commands

Quoting through SSH into PowerShell breaks easily. Use these patterns:

- **One-liners:** `ssh mini 'Get-Service sshd'`.
- **Several single-line statements:** pipe them to `powershell -NoProfile -Command -`. Stdin mode runs line by line, so a multi-line block such as `foreach { ... }` silently does nothing.
- **Anything with blocks, loops, or tricky quoting:** write a `.ps1` locally, copy it with `scp script.ps1 mini:C:/Users/herb/setup/`, then run `ssh mini 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\herb\setup\script.ps1'`.

SSH sessions are elevated, so admin changes work directly. An SSH session's PATH is fixed when the session starts. After installing something, start a new session or rebuild PATH from the registry:

```powershell
$env:Path = "$HOME\AppData\Local\mise\shims;" + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

Windows ends child processes when the SSH session closes. For long work such as a big install, register a scheduled task and poll a log file instead of holding the session open. Run it as SYSTEM for machine-wide installers, or as `herb` with S4U for jobs that need Herb's profile.

winget works over SSH. Pass `--accept-source-agreements --accept-package-agreements --disable-interactivity`.

## Layout

- `C:\Code` holds all repos, laid out like `~/Code` on the Mac. `C:\Users\herb\Code` is a junction to it, so `~/Code/...` paths from shared instructions resolve.
- `C:\Code\DevResults\devresults` is the DevResults application checkout. Other DevResults org repos (`e2e`, `viberesults`, `x3`, `toolkit`, `sdk`, `DevResults.wiki`, and so on) sit beside it in `C:\Code\DevResults`. They were cloned once and are not synced automatically.
- `C:\Code\HerbCaudill\*` holds Herb's repos, kept current by `gh-sync`.
- `C:\Users\herb\setup` holds setup scripts and logs.

## Dotfiles and agent config

`C:\Code\HerbCaudill\dotfiles` is a normal clone with `core.autocrlf=false`. Only the agent config applies on Windows. `scripts/windows/install-claude-shared-config.ps1 -RepoRoot C:\Code\HerbCaudill\dotfiles` symlinks the shared global instructions and skills into `~/.claude` and `~/.codex`, plus the Claude status line. Because these are symlinks into the clone, a pull updates them. Rerun the installer only when the list of linked items changes. Nix, launchd, and macOS-only sections do not apply.

## Repo sync

The `gh-sync` scheduled task runs `home/.local/bin/gh-sync` from the dotfiles clone through Git Bash every 15 minutes, the same schedule as the macOS launchd agent. Its log is `%LOCALAPPDATA%\gh-sync.log`. It runs as `herb` with S4U, so it cannot read Windows Credential Manager. GitHub CLI must be signed in with `gh auth login --insecure-storage`, followed by `gh auth setup-git`. Re-register the task with `scripts/windows/register-gh-sync-task.ps1` from an elevated shell.

To get a local Mac branch onto the machine without GitHub, push over SSH: `git push --receive-pack='git receive-pack' mini:C:/Code/DevResults/devresults <branch>`. The target repo needs `receive.denyCurrentBranch updateInstead` to update a checked-out branch.

## DevResults toolchain

The machine has Visual Studio 2026 Professional with the ASP.NET, .NET desktop, and .NET Framework 4.8 components, plus Git, PowerShell 7, GitHub CLI, mise (which provides Node and just), pnpm through corepack, NuGet, and SSMS. Developer Mode and long paths are on. Run repo commands from `C:\Code\DevResults\devresults` with `just`, following the repo's `AGENTS.md`. `.env.local` points `just` at Visual Studio's MSBuild and VSTest. The `setup-check` skill in the DevResults repo verifies the toolchain.

SQL Server 2025 Standard Developer runs as the default instance (`Server=.`), and `MINI\herb` is sysadmin. `sqlcmd` is not installed; from PowerShell, use `System.Data.SqlClient.SqlConnection` with `Integrated Security=true`.

Builds and unit tests need no database: `just nuget`, `just msbuild DevResults.sln -t:Build -p:Configuration=Debug -v:minimal`, `just vstest <test dlls>`, `just build-client`, and `just test` all pass there. The site runs at `https://<instance>.devlocal.us` (for example `devresults.devlocal.us`) from IIS Express on ports 80 and 443, with Azurite for blob storage. The `DevResults site` scheduled task runs `C:\Users\herb\setup\start-site.ps1`, which starts both; its logs are in `%LOCALAPPDATA%\devresults-site`. The task has no trigger, so start it with `Start-ScheduledTask 'DevResults site'` after a reboot, and stop it by ending the `iisexpress` and Azurite `node` processes. The first request after a build takes about 90 seconds to compile. The IIS Express config at `.vs\DevResults\config\applicationhost.config` and the Let's Encrypt `devlocal.us` certificate bound to `0.0.0.0:443` came from the VM. The certificate expires 2026-12-24; renew it with the repo's `ConfigureTls.ps1`, which needs the Cloudflare API token.

Scheduled tasks must call `C:\Program Files\PowerShell\7\pwsh.exe`, the machine-wide install. The Store-style `pwsh` alias under `WindowsApps` does not resolve in S4U tasks.

The `dev` and `e2e` databases were restored from the Parallels VM on 2026-10-15, and `DevResults\SecureSettings.config` was copied from it. To refresh a database, back it up on the VM `WITH COPY_ONLY, COMPRESSION`, copy the `.bak` through the Mac to a path without spaces, grant `NT SERVICE\MSSQLSERVER` read access, and restore it with `MOVE` to the default data folder.

## Maintenance

- Windows Update installs automatically and may reboot only on Sundays at 4 AM. Active hours are 6 AM to midnight, and feature updates wait 90 days. These are set as policy under `HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate`.
- The machine never sleeps or hibernates on AC power.
- Rebooting is safe: SSH, Tailscale, and the scheduled tasks all come back without a sign-in. Ask Herb before rebooting, because agents or his own sessions may be running.
