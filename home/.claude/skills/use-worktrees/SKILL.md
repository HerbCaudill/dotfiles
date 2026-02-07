---
name: use-worktrees
description: Use when the user wants work done in a git worktree so changes are isolated from the main branch until complete
user_invocation: worktree
---

# Use Worktrees

## Overview

Isolates all work for the current session in a git worktree. Creates a branch, does all work there, then merges back to main and cleans up when the task is complete.

## Usage

`/worktree` - invoke at the start of a session before doing any work

## Process

### 1. Confirm you're in a git repo on main

```bash
git rev-parse --is-inside-work-tree
git branch --show-current
```

If not on main, stop and ask the user whether to branch from the current branch or from main.

If already in a worktree (check with `git rev-parse --show-toplevel` vs `git rev-parse --git-common-dir`), stop and inform the user.

### 2. Choose a branch name

Ask the user what they're working on, then derive a short kebab-case branch name from their description (e.g. `add-search-filter`, `fix-login-redirect`). Confirm the name with the user.

### 3. Create the worktree

```bash
wt <branch-name>
```

Then change into it:

```bash
cd $(wtcd <branch-name>)
```

All subsequent work in this session happens in this directory.

### 4. Do the work

Proceed with whatever the user asks. All commits go to the feature branch in the worktree.

### 5. Merge and clean up

When the task is complete (all work committed, tests passing), merge back:

```bash
# Go back to main repo
cd $(wtcd)

# Merge the feature branch
git merge <branch-name> --no-edit

# Verify
pnpm typecheck 2>/dev/null || npm run typecheck 2>/dev/null || npx tsc --noEmit 2>/dev/null
pnpm test 2>/dev/null || npm test 2>/dev/null

# Clean up the worktree and branch
wtrm <branch-name> -b
```

If the merge has conflicts, resolve them using the same approach as the `/safe-merge` skill.

If verification fails, fix issues and commit before cleaning up.

### 6. Report

```
Merged <branch-name> into main
Commits: <count> (<first-sha>..<last-sha>)
Worktree removed
```

## Guidelines

- **Always work in the worktree** - never modify files in the main repo during the session
- **Commit frequently** - atomic commits on the feature branch
- **Verify before merging** - run typecheck and tests before merge
- **Clean up** - always remove the worktree and branch after merge
- **Ask if unsure** - if merge conflicts are complex, ask the user
