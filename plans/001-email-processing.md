# Supervised email processing

## Goal

Run the email-processing policy headlessly through the existing ChatGPT subscription while containing prompt injection and limiting Gmail writes to validated, reversible label changes.

## Approach

Keep the current email-processing skill as the human-readable policy, but move execution into a TypeScript supervisor. The supervisor alone authenticates to Gmail, selects candidates, computes deterministic protections, applies label changes, maintains state, and writes the append-only audit log.

Invoke `codex exec` only as a classifier. Give it normalized message and thread data through a strict input contract and require a strict structured result of `archive`, `promote`, or `none`. Run it ephemerally inside a dedicated permission profile with no network, MCP servers, Gmail credentials, writable workspace, or unrelated readable files. Treat inability to prove those restrictions as a startup failure.

Validate every classification outside the model. The supervisor must reject unknown message IDs, malformed output, archive decisions that violate protected-correspondent or prior-reply rules, promotions for messages already in Primary, and any mutation other than the two approved thread-level label changes. Add per-run action limits, timeouts, idempotent retries, post-mutation verification, and sanitized logging. Email content can influence a classification, but it must never become executable input or gain authority over tools.

Use fixture-based tests for policy behavior, Gmail history and retry handling, malformed classifier output, prompt-injection attempts, timeouts, partial failures, and exact label deltas. A live dry run is not required; the first live run remains reviewable through the local decision log and uses a conservative action cap.

## Tasks

1. Define the normalized message contract, structured classifier result, deterministic policy gates, and test fixtures.
2. Implement the Gmail supervisor core, including candidate discovery, history and correction handling, state, logging, exact mutations, verification, retries, and action limits.
3. Implement and verify the isolated `codex exec` classifier adapter using ChatGPT authentication.
4. Integrate the supervisor into a headless command and the email-processing skill, then verify the complete workflow and failure modes.

## Unresolved questions

- Scheduling cadence and LaunchAgent configuration are intentionally outside this plan until a cadence is chosen.
