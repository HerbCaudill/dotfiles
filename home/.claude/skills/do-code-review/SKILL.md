---
name: do-code-review
description: Use when asked to review code changes — a diff, branch, PR, or uncommitted working-tree changes. Runs a fixed multi-angle review procedure with a verification pass and reports verified findings as markdown. Report-only; does not apply fixes.
---

# Code review

Review for **precision**: every finding you surface should be one a maintainer would act on. Run the whole procedure inline in this context, sequentially — do not spawn subagents, so results are consistent across harnesses.

## Phase 0 — gather the diff

Run `git diff @{upstream}...HEAD` (or `git diff main...HEAD` / `git diff HEAD~1` if there's no upstream). If there are uncommitted changes, or the range diff is empty, also run `git diff HEAD` and include working-tree changes — review often runs before the commit. If a PR number, branch, or file path was given, review that instead. This diff is the review scope.

## Phase 1 — find candidates (5 angles, up to 6 each)

Run each angle as a separate pass over the diff. Don't let one angle's conclusions suppress another's. Each candidate records `file:line`, a one-line summary, and a concrete failure scenario.

**A — line-by-line scan.** Read every hunk, then the enclosing function — bugs on unchanged lines of a touched function are in scope. For every line ask: what input, state, timing, or platform makes this wrong? Inverted conditions, off-by-one, null/undefined deref, missing `await`, falsy-zero checks, wrong-variable copy-paste, errors swallowed in catch, unescaped regex metachars.

**B — removed-behavior audit.** For every line the diff deletes or replaces, name the invariant it enforced, then find where the new code re-establishes it. If you can't, that's a candidate: a removed guard, dropped error path, narrowed validation, deleted test covering a real case.

**C — cross-file tracer.** For each changed function, grep for its callers and check whether the change breaks any call site: new precondition, changed return shape, new exception, ordering dependency. Check callees too — does a parallel change in the same diff make a call unsafe?

**D — language pitfalls.** Scan for the classic pitfalls of the diff's language: JS/TS falsy-zero, `==` coercion, closure-captured loop vars, floating promises; Python mutable default args, late-binding closures; SQL injection; timezone/DST drift; float equality.

**E — conventions.** Find the instruction files governing the changed code: the user-level global instructions (`~/.claude/CLAUDE.md` / `AGENTS.md`), the repo-root CLAUDE.md/AGENTS.md, and any in ancestor directories of changed files. Flag only clear violations where you can quote both the rule and the offending line — no style preferences or "spirit of the doc" inferences.

Pass every candidate with a nameable failure scenario into Phase 2 — silently dropping half-believed candidates bypasses verification and is the dominant cause of misses.

## Phase 2 — verify

Dedup candidates pointing at the same line and mechanism, keeping the most concrete. Then take a second pass as a skeptic: for each candidate, actively try to refute it by re-reading the actual code, and assign exactly one verdict:

- **CONFIRMED** — you can name the inputs or state that trigger it and the wrong output or crash. Quote the line.
- **PLAUSIBLE** — the mechanism is real but the trigger is uncertain (timing, env, config). State what would confirm it.
- **REFUTED** — factually wrong or guarded elsewhere. Quote the line that proves it, then drop it.

## Output

Report at most 8 findings as markdown in chat, ranked most severe first; correctness outranks conventions. For each:

> **N. `file:line` — one-line summary** (VERDICT)
> Failure scenario: what input/state produces what wrong behavior. For conventions findings, name the instruction file and quote the rule instead.

If nothing survives verification, say so plainly. Report only — do not fix anything, propose patches, or offer to apply fixes; fixing is a separate request.
