---
name: orchestrate
description: Use when the user wants to clear the task backlog. Analyzes dependencies and file overlap to either batch independent tasks or work on them sequentially, using one subagent per task.
---

# Orchestrate: Parallel Task Dispatcher

## Overview

Dispatches ready beads tasks to parallel subagents. Analyzes task dependencies and estimated file overlap to batch independent tasks together, maximizing throughput while avoiding conflicts. If tasks cannot be batched due to dependencies or file overlap, runs them sequentially using one subagent per task.

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

Launch all tasks in the batch simultaneously using parallel Task tool calls.

- `subagent_type: "general-purpose"`
- `model: "opus"`

**Subagent prompt template**

> Complete the following task. Do not do unrelated work. Do not ask for clarification. If you are unsure about any aspect of the task, make a reasonable assumption and proceed. Do not stop until you have completed the task and all tests are passing.
>
> ## Task: {title}
>
> {description}
>
> ### Instructions
>
> - Run `bd update {id} --status=in_progress` to claim the task.
> - Write tests first. Use the `Test-Driven Development (TDD)` skill. When fixing a bug, before doing anything else, start by writing a test that reproduces the bug. Then fix the bug and prove it with a passing test.
> - While you're working, if you notice unrelated bugs or other issues, use `bd create` to file issues for another agent to work on.
> - Run `pnpm test:all` to verify everything works.
> - Update the project's CLAUDE.md or README.md with relevant changes.
> - Run `pnpm format` to format code.
> - Commit and push your changes. If you come across unrelated changes, probably the user or another agent is working in the codebase at the same time. Be careful just to commit the changes you made.
> - Run `bd close {id}` to mark the task complete.

### Repeat

After all agents in a batch finish, make a new batch and start it. Newly unblocked tasks (from completed dependencies) can be added to subsequent batches. Repeat until no open tasks remain.
