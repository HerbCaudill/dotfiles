# Managed Tasks agent

The Tasks agent module is imported but disabled by default. `services.tasksAgent.enable = false` installs no executable, creates no launchd job or state, and leaves unrelated rebuilds inert. The Tasks skill is staged in `scripts/tasks-agent/SKILL.md`, outside the live linked skills directory. This checkpoint does not activate or enroll the service and does not change capture, briefing, research, Tickler or PR writers.

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

These steps remain gated on the runtime proof, code review and explicitly selected space. The enrollment UI is being coordinated with the device-pairing work; do not substitute a device/HALO-sharing invitation. The owner browser must provision the space's EDGE agent, enable replication and issue a delegated editor space invitation. The service has a separate editor identity and uses that existing EDGE agent.

After those gates, set `services.tasksAgent.enable = true` and the explicit public `spaceId` in managed Nix source. Leave `autoStart = false` through enrollment. A normal `pnpm nix:rebuild` then installs `tasks`, `tasks-agent` and the launchd definition without starting the process. The root and private `agent/` parent are mode 0700; daemon stdout/stderr logs are inside that private parent. The separate `agent/peer/` child must be empty for initial enrollment. The receipt journal, process lock and socket stay in the parent.

Select the prepared release, then pass the one-time invitation directly through stdin to `tasks-agent enroll`. The tool unloads launchd, confirms the old owner stopped, starts the reviewed foreground service, verifies the actual ready space/identity and waits for graceful shutdown. Invitation text never enters an argument, file, release record or printed diagnostic. Do not save an invitation in a shell command, history, screenshot or test artifact.

Use `tasks-agent start`, then `tasks status` to confirm the actual serving space and peer. `tasks-agent status` reports only supervisor presence and selected release; it cannot prove the peer is healthy. Set `autoStart = true` and rebuild only after successful enrollment and restart/browser-field verification. That enables login startup and restart after exit with a 60-second throttle. `tasks-agent stop` unloads the job and waits for released ownership, preventing an immediate launchd restart.

Registration of the staged Tasks skill into `home/.claude/skills/tasks/SKILL.md` belongs to the coordinated cutover. That directory is linked live across agent tools; copying the skill there is an activation step, not inert preparation.

## Recovery and verification

If startup fails, inspect the fixed private service diagnostic and the explicitly configured space. The service checks the durable identity and current editor membership; the old binding is not authority to replace a missing or revoked credential. A failed or partial initialization must end its owning process before storage reuse. Never delete the binding, copy browser storage into the peer, consume another invitation during recovery, or select a new space to suppress an error. Revocation does not erase an already stored replica.

If shutdown fails or the process retains its lock, stop and inspect. Do not remove SQLite, receipts, sockets, caches or dependency files while a process may have them open. Do not force a release swap past the ownership check. A local `saved` receipt is distinct from independent replication; after restart, inspect historical receipts and read current fields before any retry.

The installation gate requires the real managed Node 24 executable, a command with all Tasks browsers closed, restart with the same identity/data/receipts, and an independent browser later receiving actual values. Nix evaluation and `plutil -lint` validate the inert definition; isolated release tests validate exact-commit preparation and ownership-protected promotion. These checks do not replace enrollment and field replication evidence. Scheduled work cannot run while the Mac sleeps or is off.

No workflow writer changes belong to this installation checkpoint. Keep existing Google copies, private snapshots and journals for the separate migration/reconciliation and coordinated cutover procedures.
