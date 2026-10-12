---
name: orchestrate
description: Use when the user wants to clear a ready beads backlog containing multiple independent tasks.
---

# Orchestrate: Beads Agent Dispatcher

## Overview

Dispatch ready beads tasks to subagents while the current task remains the coordinator and the only routine user-visible task. Keep a rolling set of open tasks: whenever capacity frees up, start the next ready task that does not collide with any open task. Use one implementation worker and one independent review worker per issue, enforce review before closure, and repeat until the queue is drained or blocked.

**Core principle:** An implementation worker must never review or close its own bead. Only the orchestrator closes a bead after an independent reviewer approves the pushed changes.

## Usage

`/orchestrate` - run from any git repository with beads set up

## Process

### Discover ready tasks

```bash
bd ready --json
```

If no tasks are ready, report and stop.

### Rank ready tasks

- Bugs take priority over features
- Higher priority (lower number) takes precedence

For each ready task, read its description with `bd show <id>` and estimate which files and directories it will touch. File overlap is heuristic – when in doubt, treat tasks as overlapping.

### Track open tasks

A task is open from dispatch until its bead is closed. That includes implementing, awaiting review, in review, and fixing review findings. A task in review still holds its files, because `CHANGES REQUESTED` sends the original worker back to edit them.

Keep a working record of each open task: bead ID, title, estimated files, phase, and the worker or delegated task IDs for its implementer and reviewer.

### Dispatch rule

Start the highest-ranked ready task when all of these hold:

- Its estimated files do not overlap with any open task's files
- None of its dependencies are still open
- Capacity is available (see below)
- Fewer than about 6 tasks are open, so the coordinator can still track them

If the top task collides with an open task, skip it and try the next one. A skipped task waits until the conflicting task closes.

Re-run the dispatch rule whenever a task closes, a worker frees capacity, or `bd ready --json` shows newly unblocked tasks.

If a task seems unsafe to run in the local checkout even with no overlapping open task, do not silently switch it to a worktree. Pause before dispatching it, explain the collision risk, and ask the user whether to run it alone, skip it, or use a worktree anyway.

### Choose the worker type and capacity

Use the harness's native subagents for implementation and review by default. They keep internal coordination out of the user's task list while the bead, commits, pushed branch, and orchestration task provide durable state.

Native subagent limits are not a reason to wait. When native capacity is full and T3 Code's `delegate_task` is available, dispatch the extra implementation or review work through `delegate_task` instead. Prefer `delegate_task` for reviewers when native slots are held by implementers waiting on review. Retain each returned `taskId` and use `task_status` to track it. A new review or fix round on a delegated worker is a new `delegate_task` call whose prompt includes the original brief, prior findings, and responses; use a distinct `clientRequestId` per round.

If neither native capacity nor `delegate_task` is available, queue the task until a worker finishes.

Create a standalone top-level task only when:

- The user explicitly asks for one
- The work needs sustained user interaction or a meaningful decision before it can proceed
- The work should remain independently visible and resumable after the orchestration task ends

When a standalone task is warranted, name it exactly:

```text
{id}: {title}
```

When multiple models or reasoning levels are available, use the default or balanced model and reasoning effort for clear, localized tasks, and the strongest coding/reasoning model with high reasoning effort for ambiguous, cross-cutting, or high-risk work. Escalate the model or reasoning effort when a worker is blocked by reasoning, and honor any explicit user preference.

Do not use worktrees for orchestration workers unless the user explicitly asks for a worktree in the current conversation. Worktrees add setup overhead, can make large submodules expensive to materialize, and can confuse shared beads state.

### Dispatch implementation

Give each implementation worker the bead ID and title as its task label where the harness allows.

If the harness supports goals, set a goal for the orchestration task and include the task goal in each implementation worker's prompt.

**Orchestration goal**

```text
Resolve all ready beads by dispatching non-overlapping tasks to implementation and review workers as capacity frees up, monitoring bead status, checking stuck workers when needed, and continuing until no ready tasks remain or a real blocker appears.
```

**Implementation goal**

```text
Complete Beads task {id}: {title} and leave it open for independent review.
```

**Implementation prompt template**

> Complete Beads task {id}: {title}. Leave the bead open for independent review. When ready, report `READY FOR REVIEW` with the base SHA, ordered task commit SHAs, verification commands and results, and pushed branch name.

### Dispatch independent review

When an implementation worker reports `READY FOR REVIEW`, leave the bead `in_progress` and create a fresh review worker. The reviewer must not be the implementation agent. Give it the label below where the harness allows:

```text
Review {id}: {title}
```

Require the reviewer to use the `do-code-review` skill.

**Review prompt template**

> Independently review Beads task {id}: {title} using the `do-code-review` skill. The base SHA is {base_sha}; the ordered task commit SHAs are {task_commit_shas}. The implementation agent reported: {verification_summary}. Do not edit, commit, push, or close the bead. End with exactly one verdict: `APPROVED`, `CHANGES REQUESTED`, or `BLOCKED`.

### Resolve review findings

- `APPROVED`: Confirm every reviewed commit is pushed, then the orchestrator runs `bd close {id}`, removes the task from the open set, and re-runs the dispatch rule.
- `CHANGES REQUESTED`: Send all blocking findings to the original implementation worker and trigger a follow-up turn. It must fix, verify, commit, push, and report the new commit SHAs without closing the bead. Return the complete updated commit list to the same independent reviewer and trigger a follow-up review. For delegated workers, start a new `delegate_task` round with the full history instead. Repeat until approved.
- `BLOCKED`: Keep the bead open and report the blocker to the user. Its files stay held until the task is resolved or the user says to release them.
- File worthwhile non-blocking findings as separate beads when they should not expand the current task.

Never waive review because a change is trivial, tests pass, a deadline is near, or the implementation agent is confident. A closed bead means independently reviewed and approved work, not merely pushed code.

### Monitor quietly

Use beads as the source of truth: a task is done when its issue is closed. An `in_progress` implementation may be implementing, awaiting review, or addressing findings; inspect the worker when its state stops changing.

While tasks are open:

- Poll bead state about every 30 seconds with `bd show <id>` or `bd ready --json`.
- Prefer the harness's agent wait/status mechanism, or `task_status` for delegated tasks, over repeatedly inspecting worker output.
- Inspect an implementation or review worker's latest output no more than about every 5 minutes unless the user asks for status or the bead state suggests failure/blockage.
- Polling is silent. Do not say that there is no bead-level change, that a task is still in progress, that you will keep polling, or that you are checking the thread again.
- Do not summarize routine worker progress into the orchestration task.
- Report in the orchestration task only when a task is done, stuck, failed, blocked on human input, or a new issue/dependency is discovered that changes orchestration decisions.

If a worker appears stuck, failed, or blocked on human input, notify the user if the harness supports explicit notifications. Otherwise report the issue clearly in the orchestration task.

### Finish

Stop when no tasks are open and `bd ready --json` returns nothing dispatchable, or when every remaining ready task is blocked on the user.

### Status report

If asked for a "status report" (or "update", or "how's it going", etc.), provide a concise summary of the current state of all tasks, preferably in the form of a markdown task list. Include the bead ID, title, and status for each task, and for open tasks their phase (implementing, in review, fixing). Do not include implementation or review worker output unless a task is blocked or failed.
