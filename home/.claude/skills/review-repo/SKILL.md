---
name: review-repo
description: Run code style review on all TypeScript files in a repo. Creates a worktree, reviews each file with the review-style agent, then merges into main.
user_invocation: review-repo
---

# Review Repo: Code Style Enforcement

## Overview

Systematically reviews every TypeScript file in a repository for code style compliance. Uses a worktree to isolate changes, runs the review-style agent on each file, then merges the cleaned-up code into main.

## Usage

`/review-repo` - run from any git repository

## Process

### 1. Setup worktree

```bash
# Get repo info
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_DIR=$(dirname $REPO_ROOT)/.$REPO_NAME-worktrees/style-review

# Create worktree directory if needed
mkdir -p $(dirname $WORKTREE_DIR)

# Create a new branch and worktree for the review
git worktree add -b style-review $WORKTREE_DIR
```

If `style-review` branch already exists, remove it first or use a timestamped name like `style-review-20250122`.

### 2. Find TypeScript files

```bash
cd $WORKTREE_DIR
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v dist | grep -v .next | grep -v coverage
```

### 3. Review each file

For each TypeScript file found:

1. Read the review-style agent prompt from `~/.claude/agents/review-style.md`
2. Use the Task tool with:
   - `subagent_type: "general-purpose"`
   - `model: "haiku"`
   - The agent prompt plus: `"Review: \`{filepath}\`"`
3. The agent will fix violations and commit changes

**Parallelization:** Launch multiple review agents in parallel (4-6 at a time) to speed up the process. Each agent works on a different file.

### 4. Merge into main

After all files are reviewed:

1. Ensure all changes are committed in the worktree
2. Read the safe-merge agent prompt from `~/.claude/agents/safe-merge.md`
3. Use the Task tool to run safe-merge, which:
   - Merges main into style-review (resolves conflicts in the feature branch)
   - Verifies tests pass
4. Then merge style-review into main:

```bash
cd $REPO_ROOT
git checkout main
git merge style-review --no-edit
```

### 5. Cleanup

```bash
# Remove the worktree
git worktree remove $WORKTREE_DIR

# Optionally delete the branch
git branch -d style-review
```

## Output format

**Progress updates:**

```
Creating worktree at ~/.ralph-worktrees/style-review...
Found 47 TypeScript files to review.

Reviewing files (batch 1/8):
  - src/components/App.tsx
  - src/components/Header.tsx
  - src/components/Footer.tsx
  - src/lib/utils.ts

[Agent results for each file...]

Batch 1 complete. 3 files fixed, 1 clean.
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

Merged into main via style-review branch.
Worktree cleaned up.
```

## Guidelines

- **Work in the worktree** - never modify files in the original repo directly
- **Batch agents** - launch 4-6 agents in parallel for efficiency
- **Commit incrementally** - the review-style agent commits after each file
- **Verify before merge** - always run tests before merging into main
- **Report manual items** - some issues can't be auto-fixed; list them clearly
