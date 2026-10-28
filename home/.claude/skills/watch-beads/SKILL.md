---
name: watch-beads
description: Use only when the user explicitly asks to watch or monitor beads for new issues and orchestrate them as they arrive.
---

# Watch beads

Watch the current repository's beads using a background process. The agent ends its turn between events; idle watching must not invoke a model.

## Start or resume

1. Identify the canonical repository path and the existing orchestration thread ID from the harness. Keep the same thread for implementation coordination and completion notifications. Never invent an ID or create another thread just to watch.
2. Run `watch-beads status --repo <repository>`. If another thread owns the watch, coordinate with it instead of replacing it or starting a duplicate. If this thread already owns it, leave the enrollment intact.
3. Run `watch-beads start --repo <repository> --thread <thread-id>` when not enrolled. The command validates the existing T3 thread, enables the local Beads event journal and enrolls one repository with the managed service. Use `--t3-home <path>` only when the thread belongs to an explicitly different local T3 data directory.
4. Read fresh `bd ready --json` and in-progress issues, then follow `orchestrate` for eligible work. Exclude epics, human-labelled issues and issues assigned to an existing owner from new implementation dispatch. File overlap and permission to dispatch remain the orchestrator's decisions.
5. When there is nothing to dispatch, end the turn. Keep the enrollment active. Background watcher messages and delegate completion notifications resume this thread when there is useful work.

Do not create an interval schedule, repeatedly send the watch prompt, hold an agent tool open in a sleep loop, use Monitor to poll delegates, or repeatedly inspect a running delegate. The background service owns detection; the agent owns implementation, independent review and closure.

## What wakes the thread

The managed `com.herbcaudill.watch-beads` LaunchAgent follows `bd events tail --follow`. It debounces mutations, re-reads blocker-aware readiness and existing ownership, and uses `t3 thread send` only for newly eligible IDs or when an in-progress issue leaves and eligible work is waiting. Delegate completion notifications already wake the parent separately.

The service also reconciles Beads state once a minute without model calls. This covers remote sync, journal bypasses and timed deferrals, which may emit no local journal event. Identical readiness remains quiet. Saved snapshots suppress replay after service restarts; failures preserve the previous snapshot for retry. Delivery is at least once: a crash after T3 accepts a message but before the snapshot is saved can repeat a wake-up. Always re-read issue ownership before dispatching.

Enrollment and private state live under `~/.local/share/watch-beads`; diagnostics are available from `watch-beads status --repo <repository>` and `/tmp/watch-beads.log`. The service restarts after a crash and at login. It needs the local T3 server and Dolt to be available; failures are recorded and retried without prompting the agent every minute.

## Stop

When Herb says to stop watching, run `watch-beads stop --repo <repository> --thread <thread-id>` and verify `registered: false` with `status`. This removes only that repository's enrollment. The service drops its event stream within two seconds; already accepted T3 messages cannot be recalled. Leave the journal enabled because other consumers may use it. Do not stop implementation workers unless Herb also asks to stop their work.

## Setup or recovery

The CLI and service are managed in the dotfiles repository: `scripts/watch-beads`, `nix/home/files.nix` and `nix/home/launchd.nix`. Follow that repository's instructions when changing or applying them. `start` reports an error if the LaunchAgent is unavailable; do not substitute recurring model prompts. On a host without this managed service, report the missing capability instead of installing an unreviewed polling workaround.

If an old recurring automation still targets the same thread, disable that specific automation during migration; do not create another one. Read its current state first and preserve unrelated automations.

Report only when starting work, finishing work, stopping the watch, or reporting a blocker. Routine wake-ups and idle checks stay quiet.
