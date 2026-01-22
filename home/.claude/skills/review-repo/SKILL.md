---
name: review-repo
description: Run code style review on all TypeScript files in a repo. Creates a worktree, reviews each file with the review-style agent, then merges into main.
user_invocation: review-repo
---

# Review Repo: Code Style Enforcement

## Overview

Systematically reviews every TypeScript file in a repository for code style compliance. Uses a worktree to isolate changes, runs the review-style agent on each file, and merges changes into main after each batch to minimize drift.

## Usage

`/review-repo` - run from any git repository

## Process

### 1. Setup worktree

```bash
wt style-review
wtcd style-review
```

If `style-review` branch already exists, remove it first with `wtrm style-review -b`.

### 2. Find TypeScript files

```bash
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v dist | grep -v .next | grep -v coverage
```

### 3. Review files in batches

Process files in batches of 4-6, merging after each batch:

#### For each batch:

**a. Review files in parallel**

Launch 4-6 review-style agents simultaneously:

1. Read the review-style agent prompt from `~/.claude/agents/review-style.md`
2. Use the Task tool with:
   - `subagent_type: "general-purpose"`
   - `model: "sonnet"`
   - The agent prompt plus: `"Review: \`{filepath}\`"`
3. Each agent fixes violations and commits changes

**c. Continue with next batch**

Repeat until all files are reviewed.

### 4. Merge

After the review completes, use the safe-merge agent to merge the style-review branch into main:

1. Navigate to main repo: `wtcd`
2. Checkout main: `git checkout main`
3. Use the Task tool with:
   - `subagent_type: "general-purpose"`
   - `model: "haiku"`
   - Prompt: the safe-merge agent instructions from `~/.claude/agents/safe-merge.md`, plus: `"Merge the style-review branch into main (not the other way around). After merging, go back to the worktree with 'wtcd style-review' and reset to main with 'git reset --hard main'."`

### 5. Cleanup

```bash
wtrm style-review -b
```

## Output format

**Progress updates:**

```
Creating worktree for style-review...
Found 47 TypeScript files to review.

Batch 1/8 (6 files):
  ✓ src/components/App.tsx - 2 fixes
  ✓ src/components/Header.tsx - no violations
  ✓ src/components/Footer.tsx - 1 fix
  ✓ src/lib/utils.ts - 3 fixes
  ✓ src/lib/api.ts - no violations
  ✓ src/hooks/useAuth.ts - 1 fix
Merged batch 1 into main.

Batch 2/8 (6 files):
  ...
```

**Final summary:**

```
Style Review Complete

Files reviewed: 47
Files fixed: 23
Files already clean: 24

Changes:
  - 45 block comments added
  - 12 Props types moved to end of file
  - 8 default exports converted to named exports
  - 3 files flagged for manual review (multiple components)

All changes merged into main.
Worktree cleaned up.
```

## Guidelines

- **Merge after each batch** - keeps main up to date and minimizes drift
- **Work in the worktree** - never modify files in the original repo directly
- **Batch agents** - launch 4-6 agents in parallel for efficiency
- **Reset after merge** - sync worktree to main before next batch
- **Report manual items** - some issues can't be auto-fixed; list them clearly
