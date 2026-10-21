---
name: mini
description: Use when working on or with Herb's always-on Windows mini PC (`mini`, a Minisforum) – running commands, installing software, checking scheduled tasks, syncing repos or dotfiles, or running DevResults builds and tests there. Not for the Parallels VM (`devresults-vm`).
---

# Mini (Windows mini PC)

An always-on Windows 11 Pro mini PC that hosts coding agents, especially for DevResults backend work, which needs Windows. AMD Ryzen 9 7940HS, 32 GB RAM, 1 TB SSD. Herb's account is the local administrator `MINI\herb`.

## Connecting

The machine is on Herb's tailnet as `mini`. The Mac's Home Manager SSH config has `mini` (port 22) and `mini-backup` (port 2222) entries. Both log in as `herb` with the Mac's ed25519 key. If the primary connection fails, try `ssh mini-backup` before asking Herb to intervene.

- **SSH** uses Windows OpenSSH Server. The default shell is Windows PowerShell 5.1; `pwsh` (7) is also installed. Admin keys live in `C:\ProgramData\ssh\administrators_authorized_keys`, which must be readable only by Administrators and SYSTEM.
- **Backup SSH** is the independent `sshd-backup` service on port 2222. Its Microsoft GitHub release binaries live in `C:\Program Files\OpenSSH-Backup\<release>` and its config and host key live in `C:\ProgramData\agent-access\backup`. It references the same authorized keys as the primary server and accepts key authentication only. Removing the Windows OpenSSH feature does not remove this service or its binaries.
- **Remote Desktop** is on. Herb uses the Windows App on the Mac with the host `mini`.
- Tailscale runs unattended, so the machine stays reachable after a reboot with nobody signed in.
- **Reaching the Mac:** `ssh mac` logs in as `herbcaudill@herbs-macbook-pro` with mini's `herb@mini` key. The host entry is in `home/.ssh/config.windows`, which the installer below links to mini's `~/.ssh/config`. The Mac side – Remote Login, the authorized key, and no sleep on the power adapter – is in `nix/darwin/default.nix`. The Mac is unreachable while it sleeps, such as on battery or with the lid closed.
- **Starting T3 threads across machines:** each machine runs `tailscale serve --bg 3773`, which exposes its T3 server on the tailnet at `https://mini.tailcf8536.ts.net` and `https://herbs-macbook-pro.tailcf8536.ts.net`. Claude Code on each machine has a user-level MCP server for the other: `t3-mini` on the Mac and `t3-mac` on the mini. Its `t3_thread_launch` and related tools act on the other machine's T3. Only Claude threads started after the server was added can see these tools. From an older thread, run a headless `claude -p` with the prompt on stdin and `--allowedTools "mcp__t3-mini__t3_thread_launch,…"`, because `--allowedTools` takes a variable number of arguments and swallows a trailing prompt. Launching a thread in a scratch project or a project with no default model requires an explicit `modelSelection`; get the model IDs from that server's `orchestrator_capabilities`. Codex does not have these servers. The sign-in expires after about 30 days. To renew it, run `claude mcp login t3-mini` on the Mac, or `ssh -t mini claude mcp login t3-mac`, and approve with Full access. If the sign-in page asks for a pairing code, generate it on the machine that serves the page, such as `ssh mini 't3 auth pairing create --ttl 15m'` for `t3-mini`.

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

UAC stays enabled (`EnableLUA=1`), with administrator elevation requests approved without prompting (`ConsentPromptBehaviorAdmin=0`) under `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`. Local agents can request an elevated process with `Start-Process -Verb RunAs` without Herb approving a dialog. This does not elevate an already running process; start an elevated shell when needed.

winget works over SSH. Pass `--accept-source-agreements --accept-package-agreements --disable-interactivity`.

## Layout

- `C:\Code` holds all repos, laid out like `~/Code` on the Mac. `C:\Users\herb\Code` is a junction to it, so `~/Code/...` paths from shared instructions resolve.
- `C:\Code\DevResults\devresults` is the DevResults application checkout. Other DevResults org repos (`e2e`, `viberesults`, `x3`, `toolkit`, `sdk`, `DevResults.wiki`, and so on) sit beside it in `C:\Code\DevResults`. They were cloned once and are not synced automatically.
- `C:\Code\HerbCaudill\*` holds Herb's repos, kept current by `gh-sync`.
- `C:\Users\herb\setup` holds setup scripts and logs.

## Dotfiles and agent config

`C:\Code\HerbCaudill\dotfiles` is a normal clone with `core.autocrlf=false`. Only the agent config applies on Windows. `scripts/windows/install-claude-shared-config.ps1 -RepoRoot C:\Code\HerbCaudill\dotfiles` symlinks the shared global instructions and skills into `~/.claude` and `~/.codex`, plus the Claude status line and `~/.ssh/config`. Because these are symlinks into the clone, a pull updates them. Rerun the installer only when the list of linked items changes. Nix, launchd, and macOS-only sections do not apply.

## Repo sync

The `gh-sync` scheduled task runs `home/.local/bin/gh-sync` from the dotfiles clone through Git Bash every 15 minutes, the same schedule as the macOS launchd agent. Its log is `%LOCALAPPDATA%\gh-sync.log`. It runs as `herb` with S4U, so it cannot read Windows Credential Manager. GitHub CLI must be signed in with `gh auth login --insecure-storage`, followed by `gh auth setup-git`. Re-register the task with `scripts/windows/register-gh-sync-task.ps1` from an elevated shell.

To get a local Mac branch onto the machine without GitHub, push over SSH: `git push --receive-pack='git receive-pack' mini:C:/Code/DevResults/devresults <branch>`. The target repo needs `receive.denyCurrentBranch updateInstead` to update a checked-out branch.

## Shared agent transcripts

The private `HerbCaudill/agent-transcripts` clone at `C:\Code\HerbCaudill\agent-transcripts` shares compressed text JSONL conversations with the MacBook. Readable conversation and tool text are retained; binary payloads are replaced with markers, and raw logs remain untouched. Its local Git config sets `agentTranscripts.machine` to `mini`. The `agent-transcripts-sync` scheduled task runs every 15 minutes under Herb's account with S4U, using PowerShell 7 and the newest supported Node installed by mise. It uploads mini's snapshot and retrieves the shared branch; no SSH connection to the MacBook is needed. Its log is `%LOCALAPPDATA%\agent-transcripts-sync.log`.

For a manual run, invoke `scripts/windows/sync-agent-transcripts.ps1` in the dotfiles clone. Re-register the task with `scripts/windows/register-agent-transcripts-task.ps1`. The read-agent-sessions skill can query `--machine macbook`, `--machine mini`, or `--machine all` from this clone while either computer is offline. Use `--machine local` for live mini sessions. See `docs/agent-transcripts.md` in dotfiles for recovery.

## DevResults toolchain

The machine has Visual Studio 2026 Professional with the ASP.NET, .NET desktop, and .NET Framework 4.8 components, plus Git, PowerShell 7, GitHub CLI, mise (which provides Node and just), pnpm through corepack, NuGet, and SSMS. Developer Mode and long paths are on. Run repo commands from `C:\Code\DevResults\devresults` with `just`, following the repo's `AGENTS.md`. `.env.local` points `just` at Visual Studio's MSBuild and VSTest. The `setup-check` skill in the DevResults repo verifies the toolchain.

SQL Server 2025 Standard Developer runs as the default instance (`Server=.`), and `MINI\herb` is sysadmin. `sqlcmd` is not installed; from PowerShell, use `System.Data.SqlClient.SqlConnection` with `Integrated Security=true`.

Builds and unit tests need no database: `just nuget`, `just msbuild DevResults.sln -t:Build -p:Configuration=Debug -v:minimal`, `just vstest <test dlls>`, `just build-client`, and `just test` all pass there. The site runs at `https://<instance>.devlocal.us` (for example `devresults.devlocal.us`) from IIS Express on ports 80 and 443, with Azurite for blob storage. The `DevResults site` scheduled task runs `C:\Users\herb\setup\start-site.ps1`, which starts both; its logs are in `%LOCALAPPDATA%\devresults-site`. The task has no trigger, so start it with `Start-ScheduledTask 'DevResults site'` after a reboot, and stop it by ending the `iisexpress` and Azurite `node` processes. The first request after a build takes about 90 seconds to compile. The IIS Express config at `.vs\DevResults\config\applicationhost.config` and the Let's Encrypt `devlocal.us` certificate bound to `0.0.0.0:443` came from the VM. The certificate expires 2026-12-24; renew it with the repo's `ConfigureTls.ps1`, which needs the Cloudflare API token.

Scheduled tasks must call `C:\Program Files\PowerShell\7\pwsh.exe`, the machine-wide install. The Store-style `pwsh` alias under `WindowsApps` does not resolve in S4U tasks.

The `dev` and `e2e` databases were restored from the Parallels VM on 2026-10-15, and `DevResults\SecureSettings.config` was copied from it. To refresh a database, back it up on the VM `WITH COPY_ONLY, COMPRESSION`, copy the `.bak` through the Mac to a path without spaces, grant `NT SERVICE\MSSQLSERVER` read access, and restore it with `MOVE` to the default data folder.

## Maintenance

- Windows Update installs automatically and may reboot only on Sundays at 4 AM. Active hours are 6 AM to midnight, and feature updates wait 90 days. These are set as policy under `HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate`.
- The machine never sleeps or hibernates on AC power.
- Agents may reboot without asking only when the mini is idle: nobody signed in over Remote Desktop (including disconnected sessions), no other agent sessions, and no builds or tests running. SSH, Tailscale, and the scheduled tasks come back without a sign-in. Do not reboot when any check is uncertain.

### SSH repair watchdog

Run `scripts/windows/setup-agent-access.ps1` in the dotfiles clone from an elevated PowerShell 7 shell to install or refresh agent access. It preserves `C:\ProgramData\ssh`, installs the backup server, repairs the Windows capability, services and firewall rules, sets automatic startup and failure recovery, applies the UAC policy, and registers `agent-access-watchdog`. It does not reboot, including when Windows reports a pending restart.

The watchdog runs as SYSTEM at startup and every five minutes from a protected copy at `C:\ProgramData\agent-access\setup-agent-access.ps1 -RepairOnly`, independent of Git sync. It repairs both servers separately, so a Windows servicing failure does not prevent backup access. Setup must be rerun after updating the repo script to refresh this protected copy. Logs with UTC timestamps are at `C:\ProgramData\agent-access\watchdog.log` (previous log: `watchdog.log.1`, rotated at 10 MB).

```powershell
Get-Service sshd, sshd-backup
Get-ScheduledTask -TaskName agent-access-watchdog
Get-ScheduledTaskInfo -TaskName agent-access-watchdog
Get-Content C:\ProgramData\agent-access\watchdog.log -Tail 60
Start-ScheduledTask -TaskName agent-access-watchdog
```

To verify recovery, connect through `mini-backup`, ensure no other primary SSH sessions need the listener, stop `sshd`, and leave the scheduled task alone. Check that it starts `sshd` again within five minutes and records the repair. Never stop both servers together.

### Before rebooting

Run these from an elevated SSH session immediately before a proposed reboot:

```powershell
quser.exe
Get-NetTCPConnection -State Established -LocalPort 22,2222 -ErrorAction SilentlyContinue |
  Select-Object LocalPort, RemoteAddress, RemotePort, OwningProcess
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match '^(claude|codex|pi|MSBuild|VSTest.Console|testhost|dotnet|node|npm|pnpm|just|nunit|xunit|csc|vbcsccompiler)(\.exe)?$' -or
    $_.CommandLine -match 'playwright|vitest|vstest|[ /\\]pi[ /\\]|agent.*run|build-client'
  } | Select-Object ProcessId, ParentProcessId, Name, CommandLine
Get-ScheduledTask | Where-Object State -eq Running | Select-Object TaskPath, TaskName
```

Any signed-in user reported by `quser` blocks an unattended reboot; an RDP session marked `Disc` still counts. An explicit `No User exists` response is expected when idle; access-denied or other errors do not prove idleness. The only allowed SSH connection is your own maintenance session. Inspect matching processes and running tasks for agents, builds and tests; do not treat low CPU usage as proof that an agent is inactive. Account for local agents and background tasks as well as SSH connections. If there is other work or an ambiguous process, wait and check again.

After all checks pass, record a specific reason before restarting. Windows also records the comment in System event 1074:

```powershell
$reason = 'Agent maintenance: <specific reason>; idle checks passed, no RDP users or other agents/builds/tests.'
Add-Content C:\ProgramData\agent-access\reboots.log "$([DateTime]::UtcNow.ToString('o')) $reason"
shutdown.exe /r /t 0 /d p:4:1 /c $reason
```
