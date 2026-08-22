---
name: converge-plans
description: Use when Claude and Codex should independently plan the same work, cross-review numbered drafts through a shared plan directory, and stop after semantic convergence or five review rounds so the user can choose the final plan.
---

# Converge plans

Create two independent plans, let each agent absorb improvements from the other, and stop when both plans agree semantically. Neither agent owns the final plan. The user chooses or combines the final candidates.

This skill supports one Claude participant and one Codex participant working in the same repository checkout. Use `claude` or `codex` as your participant name based on the current harness.

## Usage

The prompt must name the shared plan directory:

> Independently plan [goal], then converge with the other agent using `converge-plans` in `plans/NNN-name`.

If the user does not provide a plan directory, ask for it. Do not guess from the newest directory.

Read [the planning skill](../planning/SKILL.md) and follow its research and interview process. This skill replaces the planning skill's plan-writing and task-creation timing:

- Write agent-specific drafts during convergence, not `plan.md`.
- Do not create Beads issues until the user has selected or approved the final `plan.md`.

## Shared workspace

Use this uncommitted workspace inside the supplied plan directory:

```text
plans/NNN-name/
  convergence/
    claude/
      draft-001.md
      response-001-to-codex-draft-001.md
      draft-002.md
    codex/
      draft-001.md
      response-001-to-claude-draft-001.md
      draft-002.md
```

Never stage or commit anything under `convergence/`. Do not add it to `.gitignore`; it should remain visible in `git status` until finalization. Never edit or delete the peer's artifacts.

Treat every completed artifact as immutable. If you need to correct one, publish the next numbered artifact.

When resuming an interrupted run, inspect filenames and EOF markers without opening incomplete peer files. Resume at the first unfinished protocol step. Never overwrite a complete artifact. If an incomplete artifact in your own directory has uncertain ownership, stop and ask the user before changing it.

## Complete artifacts

Another agent may read an artifact only when its final line is the exact EOF marker described below. Ignore incomplete files and keep waiting. Writers must add the marker last.

Start each draft with this header, replacing the values:

```html
<!-- converge-plans:artifact run=014-detail-forms author=claude kind=draft sequence=001 -->
```

End it with the matching marker:

```html
<!-- converge-plans:eof run=014-detail-forms author=claude kind=draft sequence=001 -->
```

Start each response with a header that names both drafts and its verdict:

```html
<!-- converge-plans:artifact run=014-detail-forms author=claude kind=response sequence=001 own-draft=claude/draft-001.md responds-to=codex/draft-001.md verdict=revise -->
```

End it with a matching marker:

```html
<!-- converge-plans:eof run=014-detail-forms author=claude kind=response sequence=001 own-draft=claude/draft-001.md responds-to=codex/draft-001.md verdict=revise -->
```

Use the plan directory's basename as `run`. Valid response verdicts are `revise`, `converged`, and `round-limit`. Use `round-limit` only in round 5.

Check the final line rather than searching the file for `converge-plans:eof`. A partial file may contain examples or stale text that resembles a marker.

## Phase 1: independent drafts

Research and interview independently. Do not open the peer's draft, response, transcript, or planning notes until you have published your complete `draft-001.md`. You may inspect filenames only to learn whether the peer artifact exists.

After both initial drafts are complete, use the workspace artifacts as the only agent-to-agent exchange. Do not use the peer transcript as a backchannel.

Each initial draft must be a complete implementation plan that can stand on its own. Follow the target repository's plan format and instructions. Record unresolved questions honestly.

Do not write or edit `plan.md`. If this agent already wrote `plan.md` earlier in the current session, copy its plan content into your `draft-001.md` and leave `plan.md` unchanged until finalization. If ownership of an existing `plan.md` is unclear, stop and ask the user before using it.

## Phase 2: review rounds

Run at most five review rounds. `draft-001.md` is the independent starting point; review round 1 compares the two `draft-001.md` files.

For each round `N`:

1. Wait until both `draft-NNN.md` files have valid EOF markers.
2. Read the peer draft completely and verify important claims against the repository, tests, specifications, or other primary evidence.
3. Compare it with your own draft at the same number.
4. Write `response-NNN-to-{peer}-draft-NNN.md` with a valid EOF marker.
5. Wait until both response files for the round have valid EOF markers.
6. Read the peer response completely.
7. If both responses say `converged`, stop. Do not write another draft.
8. Otherwise, incorporate accepted improvements and publish the next complete numbered draft. Publish the next draft even if its plan body remains semantically unchanged; the new artifact confirms that you considered the peer response and keeps both participants in the same round.

Do not begin round `N + 1` until both complete responses from round `N` exist. Do not respond to a newer draft while the peer is still writing it.

If the peer takes time, wait using short checks rather than one blocking wait longer than 60 seconds. Keep the user informed at least once per minute while actively waiting. If the harness cannot remain active, report the exact artifact you are waiting for and resume from the workspace later; do not treat ordinary waiting as a blocker.

## Response format

Use these sections in every response:

```markdown
# Response to {peer} draft {NNN}

## Improvements to absorb

List material improvements that should change your plan, or `None`.

## Suggestions not accepted

List rejected suggestions with evidence or reasoning, or `None`.

## Remaining material differences

List unresolved semantic differences, or `None`.

## Verdict

`revise`, `converged`, or `round-limit`.
```

A response is a critique, not a rewritten plan. The next draft contains the complete revised plan.

Evaluate suggestions on their merits. Explicit user decisions outrank both drafts. Repository instructions, executable behavior, tests, specifications, and source evidence outrank unsupported plan claims. Never accept a suggestion merely to manufacture agreement, and never preserve your own choice merely because it was yours.

## Semantic convergence

Plans have converged when they have no material difference in:

- goal, scope, and exclusions;
- user-visible behavior and constraints;
- architecture, ownership, data, migration, and compatibility decisions;
- implementation and review boundaries that affect dependencies, parallelism, risk, or rollback;
- acceptance criteria and verification;
- factual claims that affect implementation; and
- unresolved questions that require later evidence or user input.

Wording, heading order, examples, and equivalent task phrasing are not material differences.

Declare `converged` only when you see no material improvement to absorb and no material correction that the peer still needs. Convergence requires complementary `converged` responses from both agents against the same exact pair of numbered drafts. If either agent says `revise`, neither agent has converged for that round.

## Round limit

In round 5, use `converged` when your own assessment finds no material difference. Otherwise use `round-limit` and list every remaining material difference. Do not use `revise` in round 5.

After both round-5 responses are complete:

1. If both responses say `converged`, stop under the normal mutual-convergence rule.
2. Otherwise, incorporate any final improvements you accept into `draft-006.md`.
3. Stop without starting a sixth review round.
4. Report both final candidate paths and the remaining differences to the user.

The round limit ends the exchange; it does not imply convergence.

## Handoff to the user

After mutual convergence, report both converged draft paths and say that they are semantically equivalent. After the round limit, report both final candidate paths and summarize the unresolved differences without choosing a winner.

Do not create `plan.md`, choose a candidate, combine plans, create Beads issues, or clean up until the user explicitly selects or approves the result.

## Finalization and cleanup

After the user selects a candidate or asks for a combination, one active agent may finalize the plan:

1. Confirm that both convergence participants have stopped writing.
2. Write the selected or combined plan body to `plan.md` without convergence headers, response text, or EOF markers.
3. Remove the entire `convergence/` directory.
4. Check `git status` and confirm that no convergence artifacts remain and no unrelated work changed.
5. Follow the planning skill's approval and Beads workflow for the finalized plan.

Never clean up merely because one participant declared convergence. The user's selection or approval is the cleanup trigger.
