---
name: do-code-review
description: Use for report-only review of a diff, branch, PR, or working tree. Checks correctness, regressions, structural drift, and duplication; verifies findings and does not apply fixes.
---

# Code review

Report only findings a maintainer would act on. Run the passes sequentially in this context; do not spawn subagents.

## Phase 0 — gather the diff

Review the requested PR, branch, path, or diff. Otherwise use `git diff @{upstream}...HEAD`, falling back to `main...HEAD` or `HEAD~1`. Include `git diff HEAD` when the tree is dirty or the range is empty.

## Phase 1 — find candidates (7 angles, up to 6 each)

Run each pass independently. Record `file:line`, a summary, and a concrete failure or maintenance impact for each candidate.

**A — line scan.** Read every hunk and enclosing function. Find the input, state, timing, or platform that makes a line fail: inverted conditions, boundary errors, null access, missing `await`, falsy-zero checks, copy-paste mistakes, swallowed errors, or unsafe regexes.

**B — removed behavior.** For each deletion or replacement, identify its invariant and where the new code restores it. Missing guards, error paths, validation, or useful tests are candidates.

**C — cross-file trace.** Check each changed function's callers and callees for new preconditions, return shapes, exceptions, or ordering dependencies.

**D — language pitfalls.** Check relevant hazards such as JS/TS coercion and floating promises, Python mutable defaults and late binding, SQL injection, timezone drift, and float equality.

**E — conventions.** Read the governing global, repository, and directory instruction files. Flag only violations supported by a quoted rule and offending line.

**F — sibling design.** Find the nearest sibling for each changed route, page, component, hook, service, form, or adapter, even outside the diff. Compare ownership, naming, layers, guards and states, permissions, data and cache flow, navigation, and UI patterns. Flag unexplained divergence or duplicated responsibility with a concrete drift risk; cite both locations and anchor the finding to changed code.

**G — economy and reuse.** Ask whether new machinery is needed, already exists, or belongs in the language, platform, an installed dependency, or an existing abstraction. Flag speculative abstractions, thin wrappers, hand-rolled substitutes, and repeated plumbing; the second concrete use is the signal to extract. Require a bounded, behavior-preserving simplification. Never trade away clarity, validation, error handling, security, accessibility, or tests for fewer lines.

Send every candidate with a concrete impact to verification.

## Phase 2 — verify

Deduplicate candidates, then try to refute each one from the code. Assign one verdict:

- **CONFIRMED** — a behavior finding has a trigger and wrong result; a structural finding has exact duplication or divergence, concrete impact, and a bounded correction. Quote the evidence.
- **PLAUSIBLE** — the mechanism is real but its trigger or consequence is uncertain. State what would confirm it.
- **REFUTED** — wrong or guarded elsewhere. Record the disproof, then drop it.

Refute matters of taste, first-use abstractions, line-count arguments, and broad redesigns without a bounded correction.

## Output

Report at most 8 findings, ranked by correctness and data safety, then maintainability, then conventions:

> **N. `file:line` — one-line summary** (VERDICT)
> Impact: the failing case or concrete maintenance cost. Cite sibling locations or governing rules when relevant.

If nothing survives, say so. Do not apply or offer fixes.
