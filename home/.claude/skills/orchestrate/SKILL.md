---
name: orchestrate
description: Use when the user wants to clear a ready beads backlog containing multiple independent tasks.
---

# Orchestrate: Beads Agent Dispatcher

## Overview

Dispatch ready beads tasks to subagents while the current task remains the coordinator and the only routine user-visible task. Choose safe batches, use one implementation subagent and one independent review subagent per issue, enforce review before closure, and repeat until the queue is drained or blocked.

**Core principle:** An implementation worker must never review or close its own bead. Only the orchestrator closes a bead after an independent reviewer approves the pushed changes.

## Usage

`/orchestrate` - run from any git repository with beads set up

## Process

### Discover ready tasks

```bash
bd ready --json
```

If no tasks are ready, report and stop.

### Analyze and batch tasks

Prioritize tasks:

- Bugs take priority over features
- Higher priority (lower number) takes precedence

For each ready task:

1. Read its description with `bd show <id>`
2. Estimate which files/directories it will touch based on the description
3. Group into batches following these rules:

**Batching rules:**

- Tasks touching different files/areas go in the same batch
- Tasks likely touching the same files go in separate sequential batches
- Max 5-6 tasks per batch
- Respect dependency order: if A blocks B, A goes in an earlier batch
- After each batch completes, re-check `bd ready --json` for newly unblocked tasks
- File overlap is heuristic - when in doubt, put tasks in separate batches
- If you cannot batch tasks, run them sequentially in separate batches of one

### Choose the worker type

Use subagents for implementation and review by default. They keep internal coordination out of the user's task list while the bead, commits, pushed branch, and orchestration task provide durable state.

Create a standalone task only when:

- The user explicitly asks for one
- The work needs sustained user interaction or a meaningful decision before it can proceed
- The work should remain independently visible and resumable after the orchestration task ends
- Subagents are unavailable in the current harness

Do not create standalone tasks merely to bypass a subagent concurrency limit. Queue the remaining work and dispatch it as capacity becomes available.

When multiple models or reasoning levels are available, use the default or balanced model and reasoning effort for clear, localized tasks, and the strongest coding/reasoning model with high reasoning effort for ambiguous, cross-cutting, or high-risk work. Escalate the model or reasoning effort when a worker is blocked by reasoning, and honor any explicit user preference.

When a standalone task is warranted, name it exactly:

```text
{id}: {title}
```

### Dispatch tasks in batches

For tasks that do not need a standalone task, create one implementation subagent for each task that fits within the harness's available concurrency. Keep enough capacity for the orchestrator; queue the rest of the batch until a worker finishes. Give each subagent the bead ID and title as its task label where the harness allows.

Do not use worktrees for orchestration workers unless the user explicitly asks for a worktree in the current conversation. Worktrees add setup overhead, can make large submodules expensive to materialize, and can confuse shared beads state.

If a task seems unsafe to run in the local checkout, do not silently switch it to a worktree. Pause before dispatching that task, explain the collision risk, and ask the user whether to run it sequentially, skip it, or use a worktree anyway.

If the harness supports goals, set a goal for the orchestration task and include the task goal in each implementation worker's prompt.

**Orchestration goal**

```text
Resolve all ready beads by dispatching safe batches to implementation and review workers, monitoring bead status, checking stuck workers when needed, and repeating until no ready tasks remain or a real blocker appears.
```

**Implementation goal**

```text
Complete the implementation for bead {id}: {title}: claim it, implement it, verify it, format, commit, push, report the exact task commit SHAs, and leave the bead open for independent review.
```

**Implementation prompt template**

> Complete the following task. Do not do unrelated work. Make reasonable assumptions for ordinary ambiguity and proceed. Stop after the implementation and any requested review fixes are verified, committed, and pushed. Leave the bead open for independent review.
>
> Goal: Complete the implementation for bead {id}: {title}. Claim it, implement it, verify it, format, commit, push, report the exact task commit SHAs, and leave the bead open for independent review.
>
> ## Task: {title}
>
> {description}
>
> ### Instructions
>
> - Run `bd update {id} --status=in_progress` to claim the task.
> - Write tests first. Use the `Test-Driven Development (TDD)` skill. When fixing a bug, before doing anything else, start by writing a test that reproduces the bug. Then fix the bug and prove it with a passing test.
> - Make reasonable assumptions for ordinary ambiguity. Ask for human input only when the next step is destructive, changes scope, risks data loss or customer data exposure, requires credentials or permissions, or presents a meaningful architectural choice.
> - While you're working, if you notice unrelated bugs or other issues, use `bd create` to file issues for another agent to work on.
> - Run `pnpm test` to verify everything works.
> - Update the project's CLAUDE.md or README.md with relevant changes.
> - Run `pnpm format` to format code.
> - Commit and push your changes. If you come across unrelated changes, probably the user or another agent is working in the codebase at the same time. Be careful just to commit the changes you made.
> - Record the starting commit before editing. In your final message, report that base SHA and the ordered SHA of every commit created for this task. Do not rely only on `HEAD`, because concurrent tasks may interleave commits in the shared checkout.
> - Do not review your own work and do not run `bd close {id}`. The orchestrator will dispatch an independent reviewer and close the bead after approval.
> - End a review-ready implementation with `READY FOR REVIEW`, followed by the base SHA, task commit SHAs, verification commands and results, and pushed branch name.
> - If you need human input and the harness provides an explicit notification mechanism, notify the user. Otherwise leave a clear final message explaining the blocker and stop.

### Dispatch independent review

When an implementation worker reports `READY FOR REVIEW`, leave the bead `in_progress` and create a fresh review subagent. If subagents are unavailable, create a standalone review task instead. The reviewer must not be the implementation agent. Give it the label below where the harness allows:

```text
Review {id}: {title}
```

Require the reviewer to use the `request-code-review` skill.

**Review prompt template**

> Independently review bead {id}: {title}. Do not edit files, commit, push, or close the bead.
>
> ## Requirements
>
> {description}
>
> ## Changes to review
>
> Base SHA: {base_sha}
> Task commit SHAs, in order: {task_commit_shas}
> Implementation verification: {verification_summary}
>
> Use the `request-code-review` skill. Review the requirements, exact task commits, final affected code, tests, and integration risks. In a shared checkout, inspect each task commit directly with `git show`; do not assume `BASE_SHA..HEAD_SHA` contains only this task. Run additional non-mutating verification when safe.
>
> Report specific findings with file and line references. Critical and Important findings block approval. Minor findings do not block unless they reveal a requirement violation. End with exactly one verdict: `APPROVED`, `CHANGES REQUESTED`, or `BLOCKED`.

### Resolve review findings

- `APPROVED`: Confirm every reviewed commit is pushed, then the orchestrator runs `bd close {id}`.
- `CHANGES REQUESTED`: Send all blocking findings to the original implementation worker and trigger a follow-up turn. It must fix, verify, commit, push, and report the new commit SHAs without closing the bead. Return the complete updated commit list to the same independent reviewer and trigger a follow-up review. Repeat until approved.
- `BLOCKED`: Keep the bead open and report the blocker to the user.
- File worthwhile non-blocking findings as separate beads when they should not expand the current task.

Never waive review because a change is trivial, tests pass, a deadline is near, or the implementation agent is confident. A closed bead means independently reviewed and approved work, not merely pushed code.

### Monitor quietly

Use beads as the source of truth: a task is done when its issue is closed. An `in_progress` implementation may be implementing, awaiting review, or addressing findings; inspect the worker when its state stops changing.

While a batch is running:

- Poll bead state about every 30 seconds with `bd show <id>` or `bd ready --json`.
- Prefer the harness's agent wait/status mechanism over repeatedly inspecting worker output.
- Inspect an implementation or review worker's latest output no more than about every 5 minutes unless the user asks for status or the bead state suggests failure/blockage.
- Polling is silent. Do not say that there is no bead-level change, that a task is still in progress, that you will keep polling, or that you are checking the thread again.
- Do not summarize routine worker progress into the orchestration task.
- Report in the orchestration task only when a task is done, stuck, failed, blocked on human input, or a new issue/dependency is discovered that changes orchestration decisions.

If a task remains `in_progress` after a bead poll or worker inspection and is still actively working, keep monitoring silently. Tool calls may appear in the transcript, but do not add assistant commentary for unchanged state.

### Repeat

After all issues in a batch are independently approved and closed, make a new batch and start it. Newly unblocked tasks from completed dependencies can be added to subsequent batches. Repeat until no open ready tasks remain.

If a worker appears stuck, failed, or blocked on human input, notify the user if the harness supports explicit notifications. Otherwise report the issue clearly in the orchestration task.

### Status report

If asked for a "status report" (or "update", or "how's it going", etc.), provide a concise summary of the current state of all tasks, preferably in the form of a markdown task list. Include the bead ID, title, and status for each task. Do not include implementation or review worker output unless a task is blocked or failed.

###
