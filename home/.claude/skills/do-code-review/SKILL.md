---
name: do-code-review
description: Use for report-only review of a diff, branch, PR, or working tree. Finds correctness problems, regressions, structural inconsistencies, and unnecessary complexity; verifies findings and does not apply fixes.
---

# Code review

Review for **precision**: every finding you surface should be one a maintainer would act on. Run the whole procedure inline in this context, sequentially — do not spawn subagents, so results are consistent across harnesses.

## Phase 0 — gather the diff

Run `git diff @{upstream}...HEAD` (or `git diff main...HEAD` / `git diff HEAD~1` if there's no upstream). If there are uncommitted changes, or the range diff is empty, also run `git diff HEAD` and include working-tree changes — review often runs before the commit. If a PR number, branch, or file path was given, review that instead. This diff is the review scope.

## Phase 1 — find candidates (7 angles, up to 6 each)

Run each angle as a separate pass over the diff. Don't let one angle's conclusions suppress another's. Each candidate records `file:line`, a one-line summary, and either a concrete failure scenario or a concrete maintenance consequence.

**A — line-by-line scan.** Read every hunk, then the enclosing function — bugs on unchanged lines of a touched function are in scope. For every line ask: what input, state, timing, or platform makes this wrong? Inverted conditions, off-by-one, null/undefined deref, missing `await`, falsy-zero checks, wrong-variable copy-paste, errors swallowed in catch, unescaped regex metachars.

**B — removed-behavior audit.** For every line the diff deletes or replaces, name the invariant it enforced, then find where the new code re-establishes it. If you can't, that's a candidate: a removed guard, dropped error path, narrowed validation, deleted test covering a real case.

**C — cross-file tracer.** For each changed function, grep for its callers and check whether the change breaks any call site: new precondition, changed return shape, new exception, ordering dependency. Check callees too — does a parallel change in the same diff make a call unsafe?

**D — language pitfalls.** Scan for the classic pitfalls of the diff's language: JS/TS falsy-zero, `==` coercion, closure-captured loop vars, floating promises; Python mutable default args, late-binding closures; SQL injection; timezone/DST drift; float equality.

**E — conventions.** Find the instruction files governing the changed code: the user-level global instructions (`~/.claude/CLAUDE.md` / `AGENTS.md`), the repo-root CLAUDE.md/AGENTS.md, and any in ancestor directories of changed files. Flag only clear violations where you can quote both the rule and the offending line — no style preferences or "spirit of the doc" inferences.

**F — sibling-design comparison.** For each changed route, page, component, hook, service, form, or data adapter, find the nearest existing sibling that performs the same job, even when it is outside the diff. Compare naming and file ownership; component and data-layer boundaries; identity validation; loading, error, and empty states; permissions; query and mutation wiring; cache updates; navigation; and shared page chrome or copy. Create a candidate when equivalent concepts follow different structures without a domain reason, or when the same responsibility appears in multiple layers. Cite both locations and name the likely drift: inconsistent behavior, duplicated fixes, or domain logic hidden by plumbing. Unchanged sibling code is evidence, not review scope; anchor the finding to the changed code.

**G — economy and reuse.** For each new abstraction, wrapper, helper, dependency, configuration option, or repeated block, ask in order: does it need to exist; does the codebase already solve it; does the language, platform, or an installed dependency solve it; can the existing structure absorb it? Flag speculative flexibility, one-implementation interfaces, wrappers that only rename another API, hand-rolled substitutes, and repeated plumbing whose differences are data rather than behavior. At the second concrete use, duplicated structure becomes a candidate for a shared primitive. Require a bounded deletion, reuse, or consolidation that preserves behavior. Do not optimize for line count or trade away clarity, validation, error handling, security, accessibility, testability, or the repository's architecture.

Pass every candidate with a nameable failure scenario or maintenance consequence into Phase 2 — silently dropping half-believed candidates bypasses verification and is the dominant cause of misses.

## Phase 2 — verify

Dedup candidates pointing at the same line and mechanism, keeping the most concrete. Then take a second pass as a skeptic: for each candidate, actively try to refute it by re-reading the actual code, and assign exactly one verdict:

- **CONFIRMED** — for a behavior finding, you can name the inputs or state that trigger it and the wrong output or crash. For a structural finding, you can point to the exact duplication or divergence, its sibling or governing convention, a concrete drift or maintenance consequence, and a bounded correction. Quote the relevant lines.
- **PLAUSIBLE** — the mechanism is real but its trigger or consequence is uncertain. State what would confirm it.
- **REFUTED** — factually wrong or guarded elsewhere. Quote the line that proves it, then drop it.

Refute structural candidates that amount only to taste, demand an abstraction at first use, optimize for fewer lines without reducing conceptual weight, or propose a broad redesign without a bounded correction.

## Output

Report at most 8 findings as markdown in chat, ranked most severe first; correctness and data safety outrank structural maintainability, which outranks conventions. For each:

> **N. `file:line` — one-line summary** (VERDICT)
> Impact: what input/state produces what wrong behavior, or what concrete duplication/divergence will cause drift or repeated maintenance. For structural findings, cite the sibling location. For conventions findings, name the instruction file and quote the rule instead.

If nothing survives verification, say so plainly. Report only — do not fix anything, propose patches, or offer to apply fixes; fixing is a separate request.
