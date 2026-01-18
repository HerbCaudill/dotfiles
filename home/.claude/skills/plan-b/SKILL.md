---
name: plan-b
description: Create a plan document and granular tasks for a feature or change. Outputs a plan doc to the repo and files issues (beads) or creates todo.md.
user_invocation: plan-b <feature-description>
---

# Plan-B: Planning Workflow

## Overview

Creates a structured plan for implementing a feature or change. Outputs:
1. A plan document in `docs/plans/` (or project root if no docs folder)
2. Granular tasks as beads issues (if available) or `todo.md`

## Usage

`/plan-b <brief description of what to build>`

Example: `/plan-b add user authentication with OAuth`

## Process

### 1. Gather Context

- Read the project's CLAUDE.md and README
- Explore relevant parts of the codebase
- Identify existing patterns and conventions

### 2. Create Plan Document

Create `docs/plans/<feature-name>.md` (or `<feature-name>-plan.md` in root) with:

```markdown
# <Feature Name>

## Goal

<One sentence describing what we're building and why>

## Approach

<High-level approach, key decisions, alternatives considered>

## Tasks

<Numbered list of implementation steps>

## Unresolved Questions

<List any open questions that need answers before or during implementation>
```

### 3. Create Granular Tasks

Check if the project uses beads (`bd` command available):

```bash
command -v bd
```

**If beads is available:**
- Create an epic for the feature
- File individual issues for each task
- Set dependencies between issues where applicable
- Link issues to the epic

**If beads is not available:**
- Create `todo.md` in project root with checkbox list:

```markdown
# <Feature Name>

- [ ] Task 1
- [ ] Task 2
  - [ ] Subtask 2a
  - [ ] Subtask 2b
- [ ] Task 3
```

### 4. Summary

After completing the plan, summarize:
- Path to plan document
- Number of tasks created
- Any unresolved questions that need user input

## Guidelines

- Be concise - plans should be scannable
- Tasks should be small enough to complete in one session
- Include test tasks (unit tests, e2e tests) as separate items
- Don't over-specify implementation details in tasks
