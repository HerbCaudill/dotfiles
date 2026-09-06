# Tasks workflow cutover preparation

This checkpoint is inert. The new PR workflow is not imported by the installed wrapper, the proposed skills are outside the linked skills directory, and no live Nix module, job, journal, checkpoint or task record has changed. Apply the reviewed patch only as part of the coordinated Tasks and Briefings cutover.

## Reviewable boundaries

`scripts/tasks-workflows/pr/` contains the inactive PR adapter and isolated tests. It reuses the existing pure notification selection and PR-link helpers. `proposed/` contains the six complete future files; `activation.patch` contains their exact changes. `manifest.json` records the source commit, original and proposed file hashes, and patch hash. The original files must still match before applying; drift requires a newly reviewed patch rather than a forced application.

| Proposed target                                 | Result after cutover                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `home/.local/bin/github-pr-task-sync`           | Calls the Tasks adapter with the explicit environment binding.                                       |
| `home/.claude/skills/task-review/SKILL.md`      | Reviews Inbox by default, with optional ordered views or projects and verified desired-state writes. |
| `home/.claude/skills/morning-briefing/SKILL.md` | Continues the pinned briefing session with one Inbox review.                                         |
| `nix/darwin/default.nix`                        | Retains the current PR job and 60-second interval; uses Node 24 and the managed Tasks launcher.      |
| `nix/home/launchd.nix`                          | Binds the existing inbox and briefing jobs and retires the old Google Tickler mover.                 |
| `CLAUDE.md`                                     | Updates repository guidance to describe the activated behavior.                                      |

The activation requires `services.tasksAgent.enable = true` and the reviewed nonempty `services.tasksAgent.spaceId`. Existing writer jobs receive that public ID as `TASKS_SPACE_ID` and require `TASKS_FRESHNESS=converged`. The adapter checks the serving metadata, persists the binding with unfinished intentions, and rejects changes to that binding. It invokes the managed `tasks` command; it does not copy credentials, pass a socket override or open the peer database. A service rebind requires a quiescent cutover, with unfinished requests reviewed first.

The current CLI reports convergence unavailable until the independent inbound freshness capability is proven. Outbound upload is not a substitute. The staged wrapper accepts explicit freshness for isolated/manual use, while every proposed automated writer requires convergence. The Briefings provider and typed journal conversion are separate reviewed changes and must be ready before these jobs resume.

## PR delivery and recovery

The checkpoint remains `~/.local/share/github-pr-task-sync/state.json`. Historical event keys and unknown legacy fields survive conversion; the adapter does not reset the existing cursor or truncate successful keys. GitHub notifications are read across all pages before processing. The previous cursor remains unchanged until the complete batch succeeds, so a failure after an earlier successful event cannot skip later notifications.

Each `notification.id:updated_at` event gets immutable original title and URL inputs plus separate deterministic capture and description request IDs. The adapter saves that intention before sending a command, then saves the returned task ID before attempting the description. Capture creates one Inbox task with event key `github-pr:<original event key>`. The separate description operation uses the original URL and an empty observed base; a newer human description produces a conflict instead of being overwritten.

An interrupted reply leaves the phase unfinished. A later poll sends the same input and request ID; the service can return its existing receipt. An unconfirmed receipt is inspected before an explicit supported retry. The workflow acknowledges only a saved capture with the expected creation identity or a saved description affecting its original target. Historical success receipts do not rewrite later human title, completion or description changes. After both phases finish, future polls use the saved event checkpoint without another mutation.

Malformed checkpoints, conflicting descriptions, unavailable service, mismatched serving space and unconfirmed outcomes stop the batch. Preserve the state and inspect the original receipts and current target before resolving the condition. Do not reset the cursor, delete the intention, substitute a new request ID or replay a reorder. A deleted or promoted destination also requires explicit review rather than a new capture. This checkpoint does not add a general conflict-resolution command or silently choose a replacement target.

State writes use a mode-0600 temporary file, fsync, atomic rename and directory fsync. A separate SQLite file in the workflow state directory provides an exclusive process lock; it contains no Tasks records and is not the ECHO database. The OS releases that lock after a crash. Files are closed before test cleanup or replacement.

## Snoozed and source context

The shared `hideUntil` operation already sets status to Inbox and clears the next-step marker at deferral time. Visibility compares the hidden-until date with the observed calendar date. A read-only check through the real shared command and read contract found one Snoozed task and zero Inbox tasks at `2026-09-06T21:59:59Z`, then zero Snoozed tasks and one Inbox task at `2026-09-06T22:00:00Z` (midnight in Europe/Madrid). The stored task JSON was identical across those reads. No new mover, transition write or heartbeat is needed.

The proposed review skill uses typed task/project targets, shared canonical Tasks URLs and reviewed source lookup for historical Google backlinks. It retains original capture times and text, research results and uncertain historical completion receipts. Missing, deleted, unavailable and ambiguous mappings remain actionable. The migration checkpoint supplies a data-preserving preview, not an applyable journal envelope; the separately reviewed Briefings version-2 conversion owns its typed target envelope. No historical note or journal is rewritten here.

## Verification

On Node 24, all 10 focused tests pass, including real child-process lost replies after both capture and description persistence, preserved later human edits, partial-batch recovery, paginated notifications, atomic state replacement, invalid state refusal, explicit freshness/space binding and lock release after SIGKILL. The full dotfiles suite passes 249 Vitest tests and 13 Node tests. Owned TypeScript passes strict checking, and the staged source passes formatting checks.

`git apply --check workflow-staging/tasks/activation.patch` succeeds against the recorded source files. An offline private source archive with a dummy space, Tasks enabled and auto-start disabled evaluates with no failed assertions. Its three generated job configurations retain the existing labels and schedules, pass the binding and convergence requirement, and omit only the old mover. The actual managed source still evaluates `services.tasksAgent.enable` to false. These are isolated configuration and process proofs; they do not establish live ECHO convergence or current-source reconciliation.

Before the live cutover, independently review this exact checkpoint; complete enrollment, runtime and inbound freshness proofs; reconcile current Tasks/source data; and integrate the reviewed routing, Briefings provider and journal conversion. Then stop the existing writers and wait for their active processes to exit before changing their linked sources or state. Preserve and inspect the old PR checkpoint and original journals, verify this manifest against the then-current files, apply the reviewed patch and service binding, rebuild the managed configuration, and prove one existing job per workflow with fresh destination readback before resuming schedules. Leave manual Google tools available for explicitly requested historical access. No part of that activation sequence has been performed by this checkpoint.
