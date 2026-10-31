---
name: retro
description: Review one coding session or a span of recent Claude Code and Codex sessions for improvements to the agent environment. Reports only; changes require approval.
disable-model-invocation: true
---

# Retro

Find the smallest useful improvements to the agent's environment. An edit or correction is evidence, not automatically a new rule. Report only: do not edit files, create issues, change configuration, send messages, or schedule work without Herb's approval of the specific change.

## Read the evidence

Default to the current session. For a specified session or date range, use `read-agent-sessions` to locate and read the primary transcripts across Claude Code and Codex. Resolve that skill's directory rather than assuming an installation path. Follow its archive freshness, timestamp filtering, privacy, and read-only rules.

For a span of recent sessions, include both harnesses and use the shared archive with `--machine all` unless Herb limits the scope. State the date range, timezone, projects, machines, harnesses, snapshot freshness, and unavailable coverage. Screen summaries and search first, then read relevant turns; inspect tool traffic only where needed. Distinguish a targeted sample from a complete review.

Count independent conversations, not copied instructions, automated prompts, repeated retries, or delegated copies of the same event. Require evidence from at least three independent sessions before proposing a general rule. A directly evidenced contradiction can justify a narrow local correction; a single-session retro can report a concrete failure without generalizing it into a preference.

Read the current files and checks before proposing changes. Separate a missing instruction from an ignored instruction, a stale instruction, and an instruction already fixed. Check whether a later explicit decision superseded an older workflow. Prefer repairing the relevant entry point over adding another global rule or observer.

## Categories

- **Navigation:** Identify time lost finding files, hidden dependencies, or existing documentation. Propose a precise pointer where the next agent will look.
- **Automated checks:** Inspect the repository's check scripts, CI, and hooks first. Identify missing guardrails, unwired checks, or broken checks before inventing replacements. A repository with no hook or CI running its relevant checks is a candidate finding; explain the concrete risk.
- **Coding standards:** Classify the mistake first. Mechanical mistakes – fixed syntax patterns, banned APIs, import shapes, or file-location rules – get a deterministic check, never a written instruction as the remedy. Recommend the cheapest suitable existing linter rule, custom rule, hook, or CI check. Reserve written standards for judgment that a check cannot replace; use the repo's existing review workflow rather than assuming a reviewer or standards file exists.
- **Global AGENTS.md:** Look for steering that belongs in a local reference, skill, review standard, or automated check. Keep global guidance sparse and applicable across projects.
- **Tool economy:** Identify repeated, expensive, or oversized calls and missing opportunities for filtering, batching, local screening, or purpose-built tools. Support cost claims with measurements, or label them estimates.
- **No-ops:** Find instructions that add context without changing behavior. Distinguish redundant text from rules that agents ignored; removing a rule is not a remedy for noncompliance.
- **Information access:** Identify unavailable evidence, logs, or read-only service access that blocked progress. Propose the smallest useful access change without requesting or exposing secrets.

## Report

Present a short list ranked by severity: safety or data loss, correctness or blocked work, then recurring time or context waste. Consider recurrence and likely benefit within each tier. Do not invent a finding to fill a category; say when none is supported.

For each finding, give the category, severity, observed consequence, exact target file or tool and proposed change, session references (machine, harness, ID and date or turn), confidence, and why existing safeguards did not cover it. Separate facts from inference. For a multi-session review, include the independent-session count and any counterevidence. Prefer a few strong findings over a lessons dump.

End with coverage limits and the specific proposals awaiting approval. Keep the report in the conversation unless Herb requested another destination. Do not implement proposals or set up recurring reviews as part of a retro.

## Attribution

Adapted from Matt Pocock's [retro skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md), under the [MIT license](LICENSE). The evidence and scope guidance incorporates the completed October 17–31, 2026 cross-harness trial: selective transcript reading, independent-session counts, current-file verification, and small corrections at existing entry points.
