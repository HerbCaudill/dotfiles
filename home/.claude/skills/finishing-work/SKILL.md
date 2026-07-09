---
name: finishing-work
description: Use when code or configuration changes are ready to verify, format, commit, push, or report as complete
---

# Finishing Work

## Overview

Finish changes with evidence, a clean diff, and a useful commit history. Use `verification-before-completion` before any success claim.

## Process

1. Inspect `git status --short --branch` and the diff.
2. Run the smallest verification set that proves the change: compile/typecheck, unit tests, and Playwright or Storybook tests when user-facing flows are affected.
3. Run the repo formatter, usually `pnpm format`.
4. Update docs or repo instructions only when durable behavior, setup, or workflow changed.
5. Recheck `git status --short` and stage only files you intentionally touched.
6. Commit immediately unless the user explicitly asked not to.
7. Push the branch. Work is not complete until push succeeds.

## Commit Messages

- Use a concise imperative first line.
- Prefer `{PrimaryThing}: {change}` when one class, function, component, script, or config area is the clear center of the change.
- Use sentence case after the colon.
- Do not end the first line with a period.
- Keep the first line specific enough that `git log --oneline` explains the change.
- Add a second line that briefly explains the purpose of the commit.
- Add more body text only when it helps future readers understand tradeoffs, migrations, or verification.

Good:

```text
EditTemplatePage: refactor data source handling

Make template editing use the shared data-loading path.

github-pr-task-sync: avoid duplicate task creation

Track notification updates so repeated polls do not recreate tasks.

Document shared agent publishing workflow

Move commit, push, and PR conventions out of always-on instructions.
```

Avoid:

```text
fix stuff
Update files.
WIP
```

## Guardrails

- Do not commit unrelated user changes.
- Keep commits atomic; list paths explicitly when staging.
- Never amend commits unless the user explicitly asks.
- If verification cannot run, say exactly what was not run and why.
