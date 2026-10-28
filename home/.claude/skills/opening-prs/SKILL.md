---
name: opening-prs
description: Use when opening, updating, or preparing a pull request after local changes are committed
---

# Opening pull requests

## Overview

Open pull requests that are easy to review: pushed branch, focused summary, clear verification, and honest remaining risk. Follow the repository's branch and PR workflow.

## Before opening

1. Confirm the branch is pushed and contains only intended commits.
2. Check whether the branch already has an open PR against the intended base. Update that PR when it is the requested target rather than opening a duplicate. Confirm the live head, base, and diff before updating its description.
3. Review the diff against the target branch.
4. Check for project PR templates or repo-specific instructions.
5. If there are UI changes, use screenshots for static changes and the `video-evidence` skill for motion or interaction changes.
6. Do not rewrite commits as part of opening a PR. Leave existing history intact unless Herb explicitly authorizes a separate history change.

## Opening a PR

Use the `gh` tool to open a PR from the command line.

Always create a draft PR so the user can review it first.

## PR title

- Use the same style as commit messages.
- Prefer `{PrimaryThing}: {change}` when there is a clear primary area.

## PR body

Start with the concrete problem and resulting behavior. For a small change, use one or two sentences plus relevant validation. Add implementation details, alternatives, screenshots, reviewer steps, and remaining risks when they help assess the change.

Describe the final diff and remove stale claims after scope changes. Claim a measured improvement only when supported by evidence. Follow the global agent attribution instructions.

## After opening

Give the user a link to the PR.

## Review hygiene

- Link related public issues when useful. Do not include internal Beads IDs in public titles or descriptions.
- Do not overstate confidence; report evidence.
- Do not ask for review until the PR description reflects the current diff.
- If updating an existing PR after review feedback, summarize the new changes since the last review while keeping the full description accurate for the final diff.
