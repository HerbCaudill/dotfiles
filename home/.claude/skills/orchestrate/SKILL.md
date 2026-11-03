---
name: orchestrate
description: Use when the user wants to clear a ready beads backlog containing multiple independent tasks.
---

# Orchestrate: Beads Agent Dispatcher

## Overview

Dispatch ready beads tasks to subagents while the current task remains the coordinator and the only routine user-visible task. Optimize for throughput: run as much as possible in parallel, and let each worker verify, push and close its own work. Repeat until the queue is drained or blocked.

**Core principle:** A task should take about as long as it would if Herb handed it directly to one agent. Pushed, self-verified work closes the task. Independent review is the exception.

## Usage

`/orchestrate` - run from any git repository with beads set up

## Process

### Discover ready tasks

```bash
bd ready --json
```

If no tasks are ready, report and stop.

### Group ready tasks

Bugs take priority over features, and a higher priority (lower number) takes precedence. Otherwise, start everything you can.

Exclude epics and human-labelled tasks. Read in-progress work and existing assignees before claiming anything; coordinate existing owners instead of duplicating their tasks.

Read each task with `bd show <id>`, then group tasks by product area. Give one worker a whole group, so that related tasks land together. Serialize only tasks that really edit the same code: a guess that two areas might overlap is not a reason to wait, because rebasing is cheaper than waiting.

### Dispatch rule

Start a worker for every group whose dependencies are closed, up to about 8 at a time. Re-run this whenever a worker finishes or `bd ready --json` shows new tasks. A dependency inside a group is the worker's to sequence.

### Choose the worker type and capacity

Use `delegate_task` when T3 Code provides it, otherwise the harness's native subagents. Retain each returned `taskId` and follow its returned `next` instruction. Completion notifications resume the parent; never poll a running delegate. Native subagent limits are not a reason to wait.

Give each parallel worker its own worktree when the repository supports it, without asking first. Follow any repository rules for isolated environments.

Create a standalone top-level task only when the user asks for one, or the work needs sustained user interaction. Name it `{id}: {title}`.

Use the default model and reasoning effort for clear, localized tasks, and the strongest model with high effort for ambiguous or cross-cutting work. Honor any explicit user preference.

### Dispatch workers

Give each worker its group name as its task label where the harness allows. If the harness supports goals, set one for the orchestration task: resolve all ready beads through parallel workers, until no ready tasks remain or a real blocker appears.

**Worker prompt template**

> Complete Beads tasks {ids}: {titles}. Claim them, verify with focused tests, typecheck and lint, plus a browser check when a change is visual. Do not run the whole test suite for each task. Commit, rebase and push to the repository's normal integration target, and resolve conflicts yourself. Then close each task with a one-line reason naming the commit. If a task needs Herb, comment on it and move on. Do not open a review or wait for one.

Repository rules still apply. Where a repository requires pull requests, such as DevResults, the worker opens the pull request and the task closes under that repository's rules.

### Keep the review server current

The coordinator owns the checkout and running server Herb uses to review changes, including Storybook. Identify its URL, process working directory, and source commit at the start. Worker worktree checks and a push to remote main do not update that server.

After each completed batch is pushed, update the review checkout to the integrated commits before reporting the changes as visible. Check for local edits and preserve them. Stop the owned server before changing files it serves, fast-forward safely, then restart it detached on the same URL. Never reset, stash, overwrite local work, or disturb another owner’s server to force an update; report the exact blocker instead.

Verify the restarted server responds and exposes a concrete changed story or behavior from the new source. A healthy old server or refreshed browser tab is insufficient. If the review server cannot be updated, distinguish “pushed” from “available in your Storybook” in the completion report. Keep this synchronization coordinator-owned so parallel workers do not restart the user’s server.

### Independent review

Do not review by default. Request it only when a change could lose data, change permissions or security behavior, alter a schema or migration, or broadly change a shared component in a risky way, or when Herb asks for it. Triviality is not the test: most changes get none.

When review is warranted, run one fresh worker using the `do-code-review` skill, without holding up other work. The reviewer blocks only on real defects, not on style, missing evidence or preferences. The coordinator fixes a real defect through one follow-up worker, or files it as a new task. Do not re-review the fix unless the fix is itself risky.

### Monitor quietly

Use beads as the source of truth: a task is done when its issue is closed.

While tasks are open:

- Use harness completion notifications. If a delegated task says completion will wake the thread, end the turn and wait for that notification; do not call status/wait tools or schedule wake-ups to check it.
- When `watch-beads` is active, its managed background service detects newly eligible work and released capacity without model calls. Leave the enrollment active between turns.
- On a completion notification or relevant watcher event, read fresh bead state and apply the dispatch rule. A duplicate wake-up is not permission to duplicate an owner or implementation.
- Inspect a worker's output when its completion, failure or explicit blocker notification arrives, or when Herb asks for status. Do not infer a stuck worker merely from unchanged issue timestamps.
- Polling is silent. Do not say that there is no bead-level change, that a task is still in progress, that you will keep polling, or that you are checking the thread again.
- Do not summarize routine worker progress into the orchestration task.
- Report in the orchestration task only when a task is done, stuck, failed, blocked on human input, or a new issue/dependency is discovered that changes orchestration decisions.

If a worker appears stuck, failed, or blocked on human input, notify the user if the harness supports explicit notifications. Otherwise report the issue clearly in the orchestration task.

### Finish

Stop when no tasks are open and `bd ready --json` returns nothing dispatchable, or when every remaining ready task is blocked on the user.

### Status report

If asked for a "status report" (or "update", or "how's it going", etc.), provide a concise summary of the current state of all tasks, preferably in the form of a markdown task list. Include the bead ID, title, and status for each task. Do not include worker output unless a task is blocked or failed.
