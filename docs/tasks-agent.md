# Managed Tasks agent

The Tasks agent is enabled and enrolled in space `B7CSO2L6KYNN4HZBSBNHP3LC3SA7PYNJO`. UI-to-CLI and CLI-to-UI changes were verified on September 30, including a headless CLI change after a service restart. The shared [Tasks skill](../home/.claude/skills/tasks/SKILL.md) is active. Nix enables login startup and restart after exit.

PR capture, hourly inbox processing and the 07:00 morning briefing now target Tasks. Briefings verifies the peer binding, requires converged reads, and persists capture/description intentions before writes. Pending legacy journals resolve exact source provenance and preserve the original record; completed research receipts remain historical and are not replayed. The September 30 cutover found 19 historical captures, no pending research and no pending inbox captures. Live capture, description readback and duplicate detection passed; the test task was deleted. The Tickler mover is retired because Snoozed resurfaces by date without writes.

## Release preparation

The managed launchers use `pkgs.nodejs_24`. Service source comes from a full Git commit under `~/Library/Application Support/Tasks/releases/<SHA>`, with its own frozen dependency installation. It never runs from a developer worktree or shared `node_modules`. `current` is the selected relative symlink. The release record includes the commit, Node version, pinned package-manager version and lockfile hash. Selection refuses a release prepared with another Node major, so prepare managed releases with the documented Node 24 executable.

The preparation tool itself uses only Node built-ins. Once a release is reviewed, prepare it without selecting it:

```sh
/etc/profiles/per-user/herbcaudill/bin/node scripts/tasks-agent/main.ts \
  --root "$HOME/Library/Application Support/Tasks" \
  prepare --repo '<Tasks checkout>' --revision '<full reviewed commit SHA>'
```

Preparation archives the exact commit, so uncommitted developer files cannot enter the release. It verifies the release's exact pnpm version, runs a frozen install including the runtime's tsx dependency, and checks both entrypoints' help. Existing releases are never overwritten. An interrupted installation leaves its private `.prepare-*` directory for inspection; stop any installation process before removing it. Do not promote a failed or incomplete release.

`tasks-agent select --revision <SHA>` unloads the managed launchd job, waits for the previous process to release its ownership lock, and atomically changes `current` while holding that same lock. It never opens ECHO SQLite. If ownership remains held, selection fails and the old release stays selected. It does not restart the service. Releases and peer state are separate, so rollback selects a reviewed compatible release without discarding data. Never run preparation inside an installed release or relink its dependencies while it is in use.

## Managed enrollment and startup

For future enrollment or recovery, use the explicitly selected space. The Tasks connection-status popover's **Connect Tasks agent** action prepares a single-use, five-minute delegated editor invitation for its selected space. It checks owner or administrator membership, provisions the owner's EDGE agent and enables the space's replication. The displayed public space ID must match the managed binding below. The service has a separate editor identity and uses that existing EDGE agent.

After those gates, set `services.tasksAgent.enable = true` and the explicit public `spaceId` in managed Nix source. Leave `autoStart = false` through enrollment. A normal `pnpm nix:rebuild` then installs `tasks`, `tasks-agent` and the launchd definition without starting the process. The root and private `agent/` parent are mode 0700; daemon stdout/stderr logs are inside that private parent. The separate `agent/peer/` child must be empty for initial enrollment. The receipt journal, process lock and socket stay in the parent.

Select the prepared release, then copy the one-time code and pass it directly through stdin with `pbpaste | tasks-agent enroll`. Keep the owner panel open until enrollment finishes. The tool unloads launchd, confirms the old owner stopped, starts the reviewed foreground service, verifies the actual ready space/identity and waits for graceful shutdown. Invitation text never enters an argument, file, release record or printed diagnostic. Do not save an invitation in a shell command, history, screenshot or test artifact. Closing the browser panel requests withdrawal of an unused code; expiry remains the limit if the network cannot confirm withdrawal.

Use `tasks-agent start`, then `tasks status` to confirm the actual serving space and peer. `tasks-agent status` reports only supervisor presence and selected release; it cannot prove the peer is healthy. Set `autoStart = true` and rebuild only after successful enrollment and restart/browser-field verification. That enables login startup and restart after exit with a 60-second throttle. `tasks-agent stop` unloads the job and waits for released ownership, preventing an immediate launchd restart.

The active skill is `home/.claude/skills/tasks/SKILL.md`. Its directory is linked live across Claude, Codex and Pi.

## Recovery and verification

If startup fails, inspect the fixed private service diagnostic and the explicitly configured space. The service checks the durable identity and current editor membership; the old binding is not authority to replace a missing or revoked credential. A failed or partial initialization must end its owning process before storage reuse. Never delete the binding, copy browser storage into the peer, consume another invitation during recovery, or select a new space to suppress an error. Revocation does not erase an already stored replica.

If shutdown fails or the process retains its lock, stop and inspect. Do not remove SQLite, receipts, sockets, caches or dependency files while a process may have them open. Do not force a release swap past the ownership check. A local `saved` receipt is distinct from independent replication; after restart, inspect historical receipts and read current fields before any retry.

The installation gate requires the real managed Node 24 executable, a command with all Tasks browsers closed, restart with the same identity/data/receipts, and an independent browser later receiving actual values. Nix evaluation and `plutil -lint` validate the inert definition; isolated release tests validate exact-commit preparation and ownership-protected promotion. These checks do not replace enrollment and field replication evidence. Scheduled work cannot run while the Mac sleeps or is off.

Keep existing Google copies, private snapshots and journals for historical lookup and explicit migration recovery.

## Windows mini installation

The mini uses `scripts/tasks-agent/windowsMain.ts` for release management, with its private root at `%LOCALAPPDATA%\Tasks`. Run `prepare --repo <Tasks checkout> --revision <full SHA>`, then `select --revision <SHA>` under Node 24. Preparation uses the release's pinned pnpm through Corepack. Selection stops the local supervisor and acquires the same ownership lock as the peer before changing the selected release. It preserves all peer storage and receipts.

Run `scripts/windows/install-tasks-agent.ps1` elevated to install `tasks` and `tasks-agent` in `~/.local/bin` and register an interactive supervisor with no automatic triggers. In the existing owner browser, use **Connect Tasks agent** for space `B7CSO2L6KYNN4HZBSBNHP3LC3SA7PYNJO`, keep the panel open, and pass its one-time invitation directly through stdin: `Get-Clipboard | tasks-agent enroll`. Never put it in chat, a command argument, a file or a transcript. Enrollment closes the verified foreground peer before returning. Then use `tasks-agent start` and `tasks status` and verify browser replication and restart with the same identity. Only after those gates, stop the peer and rerun the installer with `-AutoStart` to enable sign-in triggers and restart after exit.

The supervisor uses machine-wide PowerShell 7, rebuilds PATH from the registry and records stdout/stderr under `%LOCALAPPDATA%\Tasks\agent`. Windows storage uses owner ACLs, an authenticated loopback endpoint and SQLite FULL transactions for receipts. Unix sockets and file receipts remain unchanged on the Mac. Windows archive exports and legacy migration-preview files remain unsupported; the Tasks repo records that boundary and the current verification limits. No migration step should activate capture or briefing writers before the new peer is verified.

The Windows peer defaults to Herb's interactive session. Live migration checks found that S4U startup did not bind the endpoint, while desktop-session startup and both converged list pages succeeded with the same identity. CLI callers can still use S4U. The mini's existing automatic Windows sign-in starts the interactive peer after reboot; a disconnected Remote Desktop session remains usable. An explicit -PeerLogonType S4U option is retained for diagnostic verification, not the default deployment.

