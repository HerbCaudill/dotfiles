---
name: issues
description: Create multiple beads issues from a list. Uses judgment for priority, type, dependencies, and hierarchy.
user_invocation: issues
---

# Issues: Batch issue creation

## Overview

Creates beads issues from a user-provided list. Analyzes each item and determines appropriate classification.

## Usage

`/issues` then describe the issues to file.

## Process

### 1. Ensure beads is set up

Check for `.beads` folder. If not present, run `/beads:init`.

### 2. Wait for input

Indicate that you're ready to add issues.

### 3. Process input

Identify distinct issues from user's input. For each issue, determine type, priority, and dependencies.

### 4. Create issues

Create each issue using `bd create`. After creation, add any dependencies. If tasks need to be organized into epics, do so.

IMPORTANT: Do not work on the tasks! Only file them.

### 5. Repeat

Return to step 2: Let the user know you're waiting for further input.

## Guidelines

- Don't be chatty
- Keep titles concise but descriptive
- Default to priority 2 unless urgency is indicated
- Bugs default to priority 1
- Look for implicit dependencies (e.g., "tests for X" depends on "implement X")
- Don't over-organize - only create epics when genuinely helpful

## Sample interaction

> /issues

OK, let me know what issues to add.

> We need to add dark mode

_...bd commands_

I've filed that issue. What else?

> fix the login bug

_...bd commands_

Done.

> refactor the API client

_...bd commands_

You got it. Anything else?

```

```
