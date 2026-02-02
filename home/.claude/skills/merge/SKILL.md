---
name: merge
description: Safely merge main into the current branch, resolving conflicts and verifying tests pass
user_invocation: safe-merge
---

# Safe Merge

## Overview

Safely merges the main branch into the current feature branch. Handles conflicts intelligently, runs verification checks, and provides clear reporting.

## Usage

`/safe-merge` - merge main into current branch

## Process

### 1. Pre-flight checks

```bash
git status --porcelain
```

**If uncommitted changes exist:** Stop and report. Do not proceed until the user commits or stashes.

### 2. Identify branches

```bash
git branch --show-current
git remote show origin | grep 'HEAD branch'
```

### 3. Fetch and merge

```bash
git fetch origin
git merge origin/main --no-edit
```

### 4. Handle conflicts

If merge conflicts occur:

1. List conflicted files: `git diff --name-only --diff-filter=U`
2. For each conflicted file:
   - Read the file to understand the conflict
   - Analyze both sides (HEAD = current branch, incoming = main)
   - Make an intelligent merge decision:
     - If changes are in different parts: keep both
     - If changes overlap: understand intent and combine logically
     - If truly incompatible: prefer the more recent/complete version
   - Edit the file to resolve conflicts (remove conflict markers)
3. Stage resolved files: `git add <file>`
4. Continue merge: `git commit --no-edit`

### 5. Verify

Run project verification commands:

```bash
pnpm typecheck 2>/dev/null || npm run typecheck 2>/dev/null || npx tsc --noEmit 2>/dev/null
pnpm test 2>/dev/null || npm test 2>/dev/null
pnpm build 2>/dev/null || npm run build 2>/dev/null
```

If verification fails:

- Analyze the errors
- Fix any issues introduced by the merge
- Commit fixes with message: "fix: resolve merge issues"

### 6. Report

Provide a summary of:

- What was merged (branch names, commit range)
- Conflicts resolved (if any)
- Verification status
- Any manual follow-up needed

## Output format

**Successful merge (no conflicts):**

```
✓ Merged origin/main into feature/my-branch

Commits merged: 5 (abc123..def456)
Conflicts: none
Verification: all checks pass

Ready to push or continue development.
```

**Successful merge (with conflicts):**

```
✓ Merged origin/main into feature/my-branch

Commits merged: 3 (abc123..def456)
Conflicts resolved: 2 files
  - src/components/App.tsx (kept both changes)
  - src/lib/utils.ts (combined implementations)
Verification: all checks pass

Ready to push or continue development.
```

**Blocked:**

```
✗ Cannot merge - uncommitted changes detected

Please commit or stash these files first:
  M src/components/App.tsx
  ? src/new-file.ts

Run: git stash  (to temporarily save changes)
 or: git commit (to save changes permanently)
```

## Guidelines

- **Never force push** - always use safe operations
- **Preserve both intents** - when resolving conflicts, try to keep functionality from both sides
- **Verify before declaring success** - always run tests after merge
- **Be transparent** - report exactly what was changed and why
- **Ask if unsure** - for complex conflicts, ask the user for guidance rather than guessing
