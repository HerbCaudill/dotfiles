---
name: orchestrate
description: Use when the user wants to execute multiple ready beads tasks by dispatching them to parallel subagents. Analyzes dependencies and file overlap to batch independent tasks.
user_invocation: orchestrate
---

# Orchestrate: Parallel Task Dispatcher

## Overview

Dispatches ready beads tasks to parallel subagents. Analyzes task dependencies and estimated file overlap to batch independent tasks together, maximizing throughput while avoiding conflicts.

## Usage

`/orchestrate` - run from any git repository with beads set up

## Process

### 1. Discover ready tasks

```bash
bd ready --json
```

If no tasks are ready, report and stop.

### 2. Analyze and batch tasks

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

### 3. Present the plan

Show the user proposed batches before launching. Include estimated file areas per task.

```
Batch 1 (parallel):
  dot-42: Add login form → src/components/auth/
  dot-43: Add API rate limiting → src/lib/api/
  dot-44: Update footer links → src/components/layout/

Batch 2 (after batch 1):
  dot-45: Add auth middleware → src/lib/api/ (blocked by dot-43)
  dot-46: Add logout button → src/components/auth/ (blocked by dot-42)

Proceed?
```

Wait for user confirmation before launching any agents.

### 4. Dispatch each batch

For each task in the batch, launch a subagent using the Task tool:

- `subagent_type: "general-purpose"`
- `model: "opus"`

**Subagent prompt template:**

```
You are working on a task in a software project.

## Task
Title: {title}
Description: {description}

## Instructions

1. Run `bd update {id} --status=in_progress` to claim the task.
2. Read the project's CLAUDE.md for conventions and style guidelines.
3. Implement the task following the project's patterns.
4. Write tests for your changes.
5. Make sure everything compiles: run the project's typecheck command.
6. Run the project's test suite and make sure all tests pass.
7. Commit your changes with a descriptive message.
8. Run `bd close {id}` to mark the task complete.

If you encounter a problem that blocks you from completing the task,
do NOT close it. Instead, add a comment with `bd update {id} --notes="..."`
describing what went wrong.
```

Launch all tasks in the batch simultaneously using parallel Task tool calls.

### 5. Collect results

After all agents in a batch finish, report results:

```
Batch 1 results:
  ✓ dot-42: Add login form - completed
  ✓ dot-43: Add API rate limiting - completed
  ✗ dot-44: Update footer links - blocked: missing footer component

Moving to batch 2...
```

If any task failed, note it but continue to the next batch. Newly unblocked tasks (from completed dependencies) are added to subsequent batches.

### 6. Finalize

After all batches:

1. Run `bd sync` to push beads state
2. Report final summary:

```
Orchestration complete.

  Completed: 8/10 tasks
  Failed: 2 tasks
    dot-44: missing footer component
    dot-49: test failures in auth flow

  Run `bd list --status=open` to see remaining work.
```

## Guidelines

- **Always show the plan first** - never launch agents without user approval
- **Re-check readiness between batches** - completed tasks may unblock new ones
- **Don't retry failed tasks** - report them and move on
- **Each subagent is autonomous** - it tests, commits, and closes its own task
- **File overlap is heuristic** - when in doubt, put tasks in separate batches
