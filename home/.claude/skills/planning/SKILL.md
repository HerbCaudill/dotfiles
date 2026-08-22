---
name: planning
description: Use when the user asks to write a planning document or otherwise indicates a desire to plan before building. Create the plan and, after approval, translate it into review-sized Beads work units.
---

# Writing a plan

Create a plan that another implementation session can execute without reconstructing the important decisions. This skill owns research, interviews, plan content, user approval, and Beads task creation. The `converge-plans` skill owns the shared branch, worktree, artifacts, coordination state, commits, and final export when Claude and Codex plan together.

## Plan layout

Every plan uses a numbered directory:

```text
plans/NNN-name/
  plan.md
```

Use a padded three-digit number and a one- or two-word lowercase label, such as `plans/003-react-port/plan.md`. Inspect existing `plans/` entries and `plan-NNN` branches before choosing the next number. Resume the existing run when the user names one or when its goal clearly matches; never reuse a number for a different plan.

During a converged planning run, do not create `plan.md`, a branch, or a worktree yourself. Follow `converge-plans`; its finalizer creates `plan.md` on `main`. For a solo plan, write `plan.md` in the current user-provided worktree and branch. Do not create an extra worktree merely because this skill is active.

## Process

### 1. Gather context

- Read the repository's `CLAUDE.md` and `README.md`.
- Explore the relevant code, tests, specifications, and conventions.
- Use the `grill-me` skill when the user's decisions need clarification.
- Separate explicit requirements from preferences, tentative ideas, and your own recommendations.

### 2. Write the plan

Use this structure for `plan.md` and every convergence draft:

```markdown
# {Feature name}

## Goal

{One sentence describing what we are doing and why.}

## Approach

{The main design, decisions, constraints, and alternatives considered.}

## Tasks

1. {A review-sized implementation checkpoint with acceptance and verification details.}

## Unresolved questions

{Questions that truly require later evidence or user input, or `None`.}
```

Keep the plan concise and scannable. Include enough context in each task that a fresh implementation session can understand its outcome, acceptance criteria, and verification strategy.

### 3. Get approval and create tasks

Do not create Beads issues until the user approves the final `plan.md`. In a converged run, mutual convergence and final export do not count as user approval for task creation.

After approval, check for a `.beads` directory in the repository root.

- If Beads is not set up, use `/beads:init`.
- Create an epic when the plan spans multiple implementation sessions.
- Create one issue for each task that warrants its own implementation session and independent review.
- Keep small steps in the parent issue when they share one implementation and verification boundary.
- Record dependencies and link issues to the epic where applicable.

### 4. Report the result

Report the `plan.md` path, the number of tasks created, and any unresolved questions that still need user input.

## Task sizing

- Prefer the largest task with one coherent outcome, one set of acceptance criteria, and one verification strategy.
- Treat each top-level task or epic child as an orchestration boundary. It will usually need fresh context, verification, a commit and push, and independent review.
- Split work when it enables useful parallelism, creates a real dependency or decision boundary, carries materially different risk, or needs an independent rollback boundary.
- Combine work that touches the same files, repeats the same verification, or has no useful outcome on its own.
- For mechanical changes across many files, use a few invariant-based checkpoints instead of file-by-file tasks.
- Most plans need roughly three to eight top-level tasks, but the actual implementation boundaries decide the count.
