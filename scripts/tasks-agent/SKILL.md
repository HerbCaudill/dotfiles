---
name: tasks
description: Use the local Tasks CLI to read or change the personal board through its persistent peer, including Inbox, projects, Next steps, descriptions and task state.
---

# Tasks

This skill is staged for the coordinated Tasks cutover. Do not register it in the linked global skills directory or switch an existing writer until the runtime, enrollment, migration and review gates are approved.

Use `tasks` for board reads and writes. It connects to one local peer and works with every Tasks browser window closed. The Mac must be awake. Never open, copy into, reset or repair the peer's SQLite files as part of a normal task command.

Run `tasks --help` for names and options. `tasks status` reports the actual serving peer and space; `tasks-agent status` reports only the release and launchd job. If unavailable, inspect startup/binding diagnostics and defer. Never create a replacement identity or choose another space to bypass a failure.

Read with `tasks inbox`, `tasks next-steps`, `tasks active`, `tasks snoozed`, `tasks get --input target.json`, or the other named views. Snoozed contains only task rows, including tasks hidden by their project's date. Completed tasks remain in ordinary views with `status: "done"`; filter them out when selecting unfinished work. Keep them when deduplicating prior actions or reviewing completion history. Use stable task/project IDs. Paginate with the returned continuation and the same query; a changed result set requires refreshing after conflict. Use `--timezone Europe/Madrid` for scheduled work.

Pass JSON through `--input -` or a private UTF-8 file. Keep multiline descriptions and invitation credentials out of shell arguments. For example, once capture is authorized:

```sh
tasks capture --request-id source-event-001 --input capture.json
```

`capture.json` contains `{ "title": "Arrange the visit", "eventKey": "source-event-001" }`. Preserve the same request ID, event key and complete input across retries. A different intended write needs a new request ID; never reuse an event key with changed input. Capture, project creation and promotion require event keys.

Use only writes authorized by the current task or workflow. Ordinary authorized writes need no extra per-write confirmation. Clarify an unclear target or destructive intent before dispatch. Do not infer permission to enroll, migrate, activate scheduled writers or delete storage from permission to edit a task.

Read the full JSON response, especially its status, affected/created IDs and actual read-back records. Exit codes are 0 for ok/saved, 2 invalid, 3 conflict, 4 unavailable and 5 unconfirmed. Stdout is structured output; stderr is diagnostic. `saved` confirms local durability, not delivery to an independent browser.

After a lost reply or `unconfirmed`, run `tasks inspect --request-id <original ID>`. Keep the original receipt and any returned draft. Use `tasks retry --request-id <original ID>` only after reviewing its current evidence; uncertain reorders and other non-idempotent transitions require a new reviewed request with current preconditions. Never interpret uncertainty or a locally missing record as proof that a prior mutation did not happen.

Receipt results are historical. Their nested observation time is preserved after restart even if records changed later. The outer metadata and inspection evidence are current observations of this replica; read the record again when current fields matter.

For descriptions, fetch the current text and retain its full observed `base`. Submit `text`, `editorId` and a stable `submissionId` through `save-description`. Preserve concurrent text and the recoverable draft on conflict. Supply `expected` guards when another mutation depends on reviewed values.

Choose freshness explicitly. `local` may be stale while offline. `edge-upload` proves only the outbound barrier named in its metadata. `converged` returns unavailable unless independent freshness can actually be established; reconciliation or deduplication that requires it must defer. A successful `sync` alone is not evidence of independent browser fields.

Do not fall back automatically to Google Tasks or operate dual writers. Migration/source-ID mapping and workflow activation require their separate reviewed procedures. The selected release's `docs/tasks-cli.md` documents the complete protocol and conservative recovery rules.
