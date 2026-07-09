---
name: opening-pull-requests
description: Use when opening, updating, or preparing a pull request after local changes are committed
---

# Opening Pull Requests

## Overview

Open pull requests that are easy to review: pushed branch, focused summary, clear verification, and honest remaining risk.

## Before Opening

1. Use `finishing-work` first.
2. Confirm the branch is pushed and contains only intended commits.
3. Review the diff against the target branch.
4. Check for project PR templates or repo-specific instructions.

## PR Title

- Use the same style as commit messages.
- Prefer `{PrimaryThing}: {change}` when there is a clear primary area.
- Keep it specific and reviewable.

## PR Body

Keep the body concise. Include:

- What changed.
- Why it changed, when that is not obvious.
- Verification actually run, with command names.
- Screenshots or recordings for meaningful UI changes.
- Follow-ups, omissions, or known risks.

Use a draft PR when verification is incomplete, scope is intentionally still moving, or the user asked for early review.

## Review Hygiene

- Link related issues or beads tasks when available.
- Do not overstate confidence; report evidence.
- Do not ask for review until the PR description reflects the current diff.
- If updating an existing PR after review feedback, summarize only the new changes since the last review.
