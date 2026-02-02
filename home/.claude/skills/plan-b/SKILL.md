---
name: plan-b
description: Use this skill when the user says "let's make a plan" or otherwise indicates a desire to plan before building. Create a plan document and granular tasks for a feature or change. Outputs a plan doc to the repo and files issues (beads).
user_invocation: plan-b {feature-description}
---

# Plan-B: Planning workflow

## Overview

Creates a structured plan for implementing a feature or change. Outputs:

1. A plan document in `plans/`
2. Granular tasks as beads issues

## Usage

`/plan-b {brief description of what to build}`

Example: `/plan-b add user authentication with OAuth`

## Process

### 1. Gather context

- Read the project's CLAUDE.md and README
- Explore relevant parts of the codebase
- Identify existing patterns and conventions

### 2. Create plan document

Create `plans/{num}-{name}.md` where `num` is a padded three-digit number and `name` is a one- or two-word label for the plan. Example: `003-react-port.md`.

```markdown
# {Feature Name}

## Goal

{One sentence describing what we're doing and why}

## Approach

{High-level approach, key decisions, alternatives considered}

## Tasks

{Numbered list of implementation steps}

## Unresolved Questions

{List any open questions that need answers before or during implementation}
```

### 3. Create tasks

Once the user has approved the plan, proceed to breaking it down into

Check if the project uses beads by looking for a `.beads` folder in the root of the repository.

- If beads is not set up, use `/beads:init` to do that.
- Create one or more epics for the project
- File individual issues for each task
- Set dependencies between issues where applicable
- Link issues to the epics as appropriate

### 4. Summary

After completing the plan, summarize:

- Path to plan document
- Number of tasks created
- Any unresolved questions that need user input

## Guidelines

- Be concise - plans should be scannable
- Tasks should be small enough for you to complete in a minute or so
- Don't over-specify implementation details, but do provide a sentence or two of context in each issue's description.
