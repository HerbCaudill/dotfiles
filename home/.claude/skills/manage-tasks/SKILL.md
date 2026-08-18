---
name: manage-tasks
description: Create and manage Beads issues during planning, implementation, and triage. Use when an agent needs to record, organize, prioritize, relate, claim, defer, or close repository work with `bd`.
---

# Manage tasks

Use the Beads (`bd`) issue tracker for repositories that contain a `.beads` directory. Follow repository instructions when they differ from this skill.

## Decide whether to create an issue

- Create an issue when the user asks for one or when complex work benefits from durable tracking.
- Do not create an issue for a small, one-off task that is about to be completed unless the user asks.
- Search for related issues before creating a duplicate.

## Research the work

Inspect the relevant code, documentation, history, and existing issues before describing a problem. Record the likely cause and recommended approach when that information is practical to obtain.

If the user says a problem is "still" happening or otherwise expected it to be fixed, look for related issues and recent commits that may have attempted a fix.

## Create issues

- Use a short title and put the details in the description.
- Use `task` by default, `bug` for incorrect behavior, and `epic` for independently deliverable child tasks. Do not use `feature`.
- Use priorities P0-P4, where P0 is highest and P2 is the default.
- Add blocking dependencies with `bd dep add <issue> <depends-on>`.
- Link earlier work on the same topic with `--deps related:<id>`.
- Include acceptance criteria and a verification strategy when the outcome is not obvious.

### Task size

Treat a top-level task or epic child as a separate implementation and review unit. Give it a coherent outcome, acceptance criteria, and verification strategy that justify a fresh session.

- Prefer one task when the steps touch the same files, repeat the same verification, or only make sense together.
- Split work when the children can proceed independently, expose a real dependency or decision boundary, carry different risks, or need separate rollback boundaries.
- Keep small implementation steps in the issue description or model them as subtasks.
- Do not create separate issues merely because a plan has numbered steps or a change touches many files.
- Size the boundary around review risk, not line count.

### Subtasks and epics

- Create subtasks under a non-epic parent with `--parent=<id>`. Their IDs use the form `<parent-id>.1`. Ralph completes the parent and its subtasks as one implementation unit.
- Create independent tasks under an `epic` with `--parent=<id>`. Each child gets its own ID and implementation session.

Use subtasks for granular steps within one implementation and review unit. Use an epic only when its children warrant separate implementation sessions and independent reviews.

## Update issues

- Change status, title, description, priority, assignee, or parent as needed.
- Add comments when they preserve useful task-specific history.
- Close completed issues and close a parent when all its children are complete.
- Use dependencies to represent actual blocking relationships, not mere sequencing preferences.

## Preserve knowledge

- Keep task-specific context in the issue description, notes, or comments.
- Put durable repository-wide instructions and facts in the repository's `CLAUDE.md` or normal documentation so they remain visible, reviewable, and portable across agents.
- Do not use `bd remember` or install `bd prime` hooks unless the user explicitly asks for them.
- Use `bd --help` for unfamiliar syntax instead of injecting the full CLI guide into every session.

## Command reference

```bash
bd ready                     # Show issues ready to work
bd list --status=open        # Show open issues
bd list --status=in_progress # Show active work
bd show <id>                 # Show issue details

bd create --title="..." --description="..." --type=task|bug|epic --priority=2
bd update <id> --claim
bd update <id> --status=in_progress
bd update <id> --assignee=username
bd close <id>
bd close <id1> <id2> ...

bd dep add <issue> <depends-on>
bd blocked
bd comments add <id> "..." --author=<name>
```
