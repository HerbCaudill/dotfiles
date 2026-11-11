# Jev email job

## Goal

Run Herb's email processing on the mini with the tuned Jev rules instead of the Codex classifier, and surface anything that needs his approval, such as unsubscribes and new Gmail filters, as Tasks Inbox items that the morning briefing reviews with him.

## Approach

The supervisor in `runGmailSupervisor.ts` keeps its mechanics: Gmail history discovery, durable state and retries, verified thread-level label changes, the append-only decision log, and detection of Herb's reversals. Only the policy changes. Jev's answers plus `decideFromJevAnswers` replace the Codex classifier, its prompt, its input and output schemas, its calibration cases and the classification-based validation. This is a hard cutover; the Codex path is removed, not kept as a fallback.

Policy, as tuned against Herb's 881 corrections (see the vault note `documents/Unsubscribing from marketing email.md`):

- Gmail filters handle repeat senders before the job sees them. The job handles what reaches the inbox.
- Rules first: the Keep label, an undone archive, calendar invitations (keep) and replies (archive), auto-replies, clear marketing, personal mail from a correspondent. Then Jev's `keep_in_inbox` answer at 0.5. Everything else is archived.
- Hard guards stay in code: never archive a `@devresults.com` sender, only the two existing label deltas (archive, promote to Primary), a per-run action cap.
- The job never unsubscribes or creates filters on its own. It queues proposals; Herb approves them in his Tasks Inbox, usually during the morning briefing's Inbox review; an `email-processing approve` command carries out only what he approved and remembers what he declined.

Rollout on the mini: a scheduled Windows task runs the job in log-only mode for a few days. Herb reviews what it would have done, then archiving is switched on.

Alternatives considered: keeping Codex as the classifier (worse agreement with Herb's labels, and its isolation probes don't work on Windows); a briefing section instead of Tasks items (the briefing is read-only presentation; Tasks items also wait for days without a briefing).

## Tasks

1. **Jev policy in the supervisor.** Move the per-message facts the Jev rules need (List-Id, one-click unsubscribe, calendar METHOD, auto-reply headers, Keep label) out of `runJevDryRun.ts` into the supervisor's candidate normalization. Replace `classify` with a Jev classifier that returns `decideFromJevAnswers` decisions, keep the hard guards, and remove the Codex classifier, prompt, schemas, calibration and preflight. Raise the action cap to fit an archive-by-default policy. Log the unsubscribe eligibility with each decision.
2. **Windows support and log-only mode.** Make the job and its tests run on the mini: resolve `gws-delegated` through its `.cmd` shim, and handle file permissions that Windows doesn't support. Add a log-only mode that classifies and logs without changing Gmail, and a summary of what it would have done.
3. **Approval queue and command.** Each run adds eligible unsubscribes and filter proposals (senders archived at least N times, never restored, not already covered by a filter) to a pending queue. A daily step turns the queue into one Tasks Inbox item per kind, listing senders with a sample subject. `email-processing approve <batch> [--except ...]` sends one-click unsubscribes or creates filters for the approved senders, records results and declines, and completes the task.
4. **Schedule on the mini and document.** Register a Windows scheduled task in log-only mode, update the `email-processing` skill and policy, and the vault note. After Herb reviews a few days of logs, switch archiving on.

## Unresolved questions

- How many archives of a sender, with no reversal, before the job proposes a filter? Starting point: 3 within 30 days.
- How often the job runs on the mini. Starting point: hourly from 07:00 to 23:00.
