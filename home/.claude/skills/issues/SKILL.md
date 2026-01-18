---
name: issues
description: Create multiple beads issues from a list. Uses judgment for priority, type, dependencies, and hierarchy.
user_invocation: issues
---

# Issues: Batch issue creation

## Overview

Creates beads issues from a user-provided list. Analyzes each item and determines appropriate:

- Issue type (task, bug, feature)
- Priority (0-4)
- Dependencies between issues
- Epic groupings if applicable

## Usage

`/issues` then describe the issues to file

Example: `/issues` followed by "We need to add dark mode, fix the login bug, and refactor the API client"

## Process

### 1. Ensure beads is set up

Check for `.beads` folder. If not present, run `/beads:init`.

### 2. Parse the user's input

Identify distinct issues from the description. Each issue may be:

- A feature request
- A bug report
- A task/chore
- An epic containing sub-issues

### 3. Determine metadata

For each issue, determine:

**Type:**
- `feature` - New functionality
- `bug` - Something broken
- `task` - Chores, refactoring, documentation

**Priority (0-4):**
- 0 (P0) - Critical/blocking
- 1 (P1) - High priority
- 2 (P2) - Medium (default)
- 3 (P3) - Low priority
- 4 (P4) - Backlog

**Dependencies:**
- If issue B requires issue A to be done first, add dependency
- Use `bd dep add <child> <parent>` after creation

**Epics:**
- Group related issues under an epic if there are 3+ related items
- Create epic first, then link child issues

### 4. Create issues

Use parallel subagents when creating multiple issues for efficiency.

```bash
bd create --title="..." --type=task|bug|feature --priority=2
```

After creation, add any dependencies:

```bash
bd dep add <dependent-issue> <dependency>
```

### 5. Summary

Output a table summarizing created issues:

| ID | Title | Type | Priority | Depends on |
|----|-------|------|----------|------------|

## Guidelines

- Keep titles concise but descriptive
- Default to priority 2 unless urgency is indicated
- Bugs default to priority 1
- Look for implicit dependencies (e.g., "tests for X" depends on "implement X")
- Don't over-organize - only create epics when genuinely helpful
