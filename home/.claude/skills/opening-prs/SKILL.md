---
name: opening-prs
description: Use when opening, updating, or preparing a pull request after local changes are committed
---

# Opening Pull Requests

## Overview

Open pull requests that are easy to review: pushed branch, focused summary, clear verification, and honest remaining risk.

## Before opening

1. Confirm the branch is pushed and contains only intended commits.
2. Review the diff against the target branch.
3. Check for project PR templates or repo-specific instructions.
4. If there are UI changes, take screenshots or screen recordings (using the computer use skill) to include in the PR description.
5. Collapse any runs of `WIP` commits into a single commit

## Opening a PR

Use the `gh` tool to open a PR from the command line.

Always create a draft PR so the user can review it first.

## PR title

- Use the same style as commit messages.
- Prefer `{PrimaryThing}: {change}` when there is a clear primary area.

## PR body

Include:

- A summary of the problem or motivation for the change
- Summary of this solution, possibly including rejected alternatives (and why)
- A more detailed description of individual changes.
- Screenshots or recordings for UI changes.
- Follow-ups, omissions, or known risks.
- Description of any manual/automated testing done
- Instructions for how a reviewer can verify the change.

## After opening

Give the user a link to the PR.

## Review hygiene

- Link related issues or beads tasks when available.
- Do not overstate confidence; report evidence.
- Do not ask for review until the PR description reflects the current diff.
- If updating an existing PR after review feedback, summarize only the new changes since the last review.
