---
name: orchestrate
description: Use when the user wants to clear a beads task backlog across multiple independent issue threads.
---

# Orchestrate: Beads Thread Dispatcher

## Overview

Dispatch ready beads tasks into named standalone Codex threads. Use the current thread as the coordinator: choose safe batches, create one task thread per issue, monitor bead state, inspect stuck threads when needed, and repeat until the queue is drained or blocked.

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

### Dispatch tasks in batches

Create one standalone thread for each task in the batch. Use a local project thread by default. Use a worktree only when the user explicitly asks for isolation, the user is actively working in the same checkout, or the task is long-running/high-risk enough that local checkout interference is likely.

Name each task thread exactly:

```text
{id}: {title}
```

If the harness supports thread goals, set a goal for the orchestration thread and for each task thread.

**Orchestration thread goal**

```text
Drain the ready beads queue by creating named task threads for safe batches, monitoring bead status, checking stuck threads when needed, and repeating until no ready tasks remain or a real blocker appears.
```

**Task thread goal**

```text
Complete bead {id}: {title} end to end: claim it, implement it, verify it, format, commit, push, close the bead, and stop only for a real blocker requiring human input.
```

**Task thread prompt template**

> Complete the following task. Do not do unrelated work. Make reasonable assumptions for ordinary ambiguity and proceed. Do not stop until you have completed the task and all tests are passing, unless you hit a real blocker requiring human input.
>
> Goal: Complete bead {id}: {title} end to end. Claim it, implement it, verify it, format, commit, push, close the bead, and stop only for a real blocker requiring human input.
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
> - Run `pnpm test:all` to verify everything works.
> - Update the project's CLAUDE.md or README.md with relevant changes.
> - Run `pnpm format` to format code.
> - Commit and push your changes. If you come across unrelated changes, probably the user or another agent is working in the codebase at the same time. Be careful just to commit the changes you made.
> - Run `bd close {id}` to mark the task complete.
> - If you need human input and the harness provides an explicit notification mechanism, notify the user. Otherwise leave a clear final message explaining the blocker and stop.

If thread-management tools can create threads but cannot wait for automatic replies, keep supervising manually. Use beads as the source of truth: a task is done when its issue is closed. If a task remains `in_progress` for longer than expected, or the user asks for a status update, inspect that task thread's latest output to see whether it is stuck, blocked, or still working.

### Repeat

After all issues in a batch are closed, make a new batch and start it. Newly unblocked tasks from completed dependencies can be added to subsequent batches. Repeat until no open ready tasks remain.

If a task thread appears stuck, failed, or blocked on human input, notify the user if the harness supports explicit notifications. Otherwise report the issue clearly in the orchestration thread.
