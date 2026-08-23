---
name: planning
description: Use to plan before building, then convert an approved plan into review-sized Beads tasks.
---

# Writing a plan

## Overview

Creates a structured plan for implementing a feature or change. Outputs:

1.  A plan document in `plans/`
2.  Reviewable implementation tasks as Beads issues

## Process

### 1\. Gather context, if you haven't already

- Read the project's CLAUDE.md and README
- Explore relevant parts of the codebase
- Identify existing patterns and conventions
- Use the `grill-me` skill to clarify the user's thinking

### 2\. Create plan document

Create `plans/{num}-{name}.md` where `num` is a padded three-digit number and `name` is a one- or two-word label for the plan. Example: `003-react-port.md`.

```
# {Feature Name}

## Goal

{One sentence describing what we're doing and why}

## Approach

{High-level approach, key decisions, alternatives considered}

## Tasks

{Numbered list of implementation checkpoints}
```

### 3\. Create tasks

Once the user has approved the plan, translate its checkpoints into reviewable work units.

Check if the project uses beads by looking for a `.beads` folder in the root of the repository.

- If beads is not set up, use `/beads:init` to do that.
- Create an epic when the plan is large enough to span multiple implementation sessions.
- File one issue for each task that warrants its own implementation session and independent review.
- Keep smaller steps in the issue description or create subtasks when they belong to the same implementation and review unit.
- Set dependencies between issues where applicable
- Link issues to the epics as appropriate

### 4\. Summary

After completing the plan, summarize:

- Path to plan document
- Number of tasks created
- Any unresolved questions that need user input

## Guidelines

- Be concise; plans should be scannable.
- Prefer the largest task that still has one coherent outcome, one set of acceptance criteria, and one verification strategy.
- Treat every top-level task or epic child as an orchestration boundary: it will usually require fresh implementation context, verification, a commit and push, and independent review.
- Split work when it enables meaningful parallelism, introduces a real dependency or decision boundary, carries materially different risk, or needs an independent rollback boundary.
- Combine work that touches the same files, repeats the same verification, or is only meaningful when the neighboring steps are complete.
- Keep minute-scale implementation steps inside a task rather than turning each one into a separate issue.
- For mechanical changes across many files, prefer a few invariant-based checkpoints over file-by-file tasks.
- Most plans should need roughly 3-8 top-level tasks. Use fewer or more when the actual implementation and review boundaries justify it.
- Don't over-specify implementation details, but do provide a sentence or two of context in each issue's description.
