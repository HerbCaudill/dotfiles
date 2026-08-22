---
name: converge-plans
description: Use when Claude and Codex should independently plan the same work, cross-review numbered drafts through a shared plan directory, and produce one final plan after semantic convergence or five review rounds.
---

# Converge plans

Claude and Codex independently plan the same work, review the same numbered draft pair, and keep revising until their plans agree semantically or they complete five review rounds. Both participants share one dedicated `plan-NNN` branch and worktree. The helper owns every write and Git-changing operation in that worktree.

Read [the planning skill](../planning/SKILL.md) before starting. Use its research, interview, plan format, and task-sizing guidance. This skill replaces its file, branch, worktree, commit, and finalization steps until `plan.md` is on `main`. Do not create Beads issues until the user later approves that final plan.

## Start or resume a run

The prompt should name a directory such as `plans/014-detail-forms`. If it does not, inspect existing plan directories and `plan-NNN` branches, then choose the next unused padded number and a short lowercase label. Resume an existing run when its recorded goal matches; never reuse its number for another goal.

Use your harness name, `claude` or `codex`, as the participant value:

```bash
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" init plans/014-detail-forms --participant claude
```

`init` creates `plan-014` from `main` and adds its shared worktree the first time. Later calls resume that exact branch and worktree. Use the returned `worktree` path for every later command and all repository reads. Claude and Codex may run in that same path.

Immediately after `init`, create a persistent harness goal for your participant. The objective must say to advance this run autonomously until mutual convergence, the round limit, successful finalization or a lost finalizer claim, or a genuine blocker. Do not set a token budget. Resume the existing goal when the session already has one for this run. Keep advancing without waiting for another user turn while the peer protocol can make progress.

## Shared-worktree rules

The shared branch must stay checked out for the whole run. Never run `git switch`, `git checkout`, `git worktree`, `git add`, `git commit`, `git merge`, `git rebase`, `git cherry-pick`, `git reset`, or another Git-changing command in any worktree for this run. Never ask the peer to change branches. The helper serializes state changes and commits with a repository-wide lock.

Do not write directly anywhere in the shared worktree. Draft an artifact in harness scratch space or a temporary file outside the repository, then publish it through the helper. The helper permits only:

```text
plans/NNN-name/convergence/
  .protocol/state.json
  claude/
    draft-001.md
    response-001-to-codex-draft-001.md
  codex/
    draft-001.md
    response-001-to-claude-draft-001.md
```

Each participant may publish only its own artifacts. Protocol state belongs to the helper. Published artifacts are immutable. Corrections require the next numbered artifact.

Run this before reading a peer artifact and whenever repository state looks surprising:

```bash
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" check plans/014-detail-forms --participant claude
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" status plans/014-detail-forms
```

`check` verifies the worktree and branch, committed and uncommitted paths, registered artifact hashes, metadata, headings, rounds, EOF markers, conflict markers, and literal `\n` text outside fenced code. Stop if it reports an uncoordinated write. Do not repair, delete, stage, or commit the write by hand.

Every state-changing helper command commits only protocol paths on `plan-NNN`. These intermediate commits are expected. They preserve the exchange as an audit trail and remain on the plan branch.

## Artifact format

Start a draft with this exact metadata, using the directory basename as `run`:

```html
<!-- converge-plans:artifact run=014-detail-forms author=claude kind=draft sequence=001 -->
```

End it with the matching marker as the final nonblank line:

```html
<!-- converge-plans:eof run=014-detail-forms author=claude kind=draft sequence=001 -->
```

Drafts use the planning skill's full plan format. A draft must stand on its own and end with `## Unresolved questions`, using `None` when there are no questions.

Start a response with exact metadata that names both drafts and its verdict:

```html
<!-- converge-plans:artifact run=014-detail-forms author=claude kind=response sequence=001 own-draft=claude/draft-001.md responds-to=codex/draft-001.md verdict=revise -->
```

End it with the same fields after `converge-plans:eof`. Valid verdicts are `revise`, `converged`, and `round-limit`. Use `round-limit` only in round 005; never use `revise` in round 005.

Every response uses these exact headings:

```markdown
# Response to Codex draft 001

## Improvements to absorb

## Suggestions not accepted

## Remaining material differences

## Verdict
```

The verdict body is the metadata verdict in backticks. A response is a critique, not a replacement plan.

Publish a complete artifact from its temporary source file. The helper validates it, chooses its immutable destination, records its hash, and commits it:

```bash
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" publish plans/014-detail-forms --participant claude --file /tmp/claude-draft-001.md
```

## Phase 1: independent drafts

Research and interview independently. Before publishing your complete `draft-001.md`, do not open the peer's draft, response, transcript, private interview, planning notes, or artifact contents. You may use `status` to see whether filenames have been published.

Use repository evidence and the shared user prompt as common ground. Agent-specific interview notes do not become separate hard requirements. If private interviews appear to report different user decisions, treat both reports as evidence. Resolve ordinary conflicts without asking the user by choosing the best approach and recording your rationale in the response and next draft. Only an explicit hard requirement in the shared prompt acts as a veto.

## Phase 2: review rounds

Run at most five review rounds. `draft-001.md` is the independent starting pair; response round 001 compares those two drafts.

For each round `N`:

1. Use `status` and `check` until both `draft-NNN.md` artifacts are published.
2. Read the peer draft completely and verify important claims against the repository, tests, specifications, or other primary evidence.
3. Compare it with your draft from the same round.
4. Publish `response-NNN-to-{peer}-draft-NNN.md`.
5. Wait until both response artifacts for the round are published, then read the peer response completely.
6. If both verdicts are `converged`, record `converged` status and proceed to finalizer selection.
7. Otherwise, absorb accepted improvements and publish the next complete draft. Publish it even when the plan body stays semantically unchanged; the new artifact proves that you considered the response and keeps both participants on one round.

Do not start round `N + 1` until both responses from round `N` exist. Do not respond to a newer draft while the peer is still writing it. Ordinary waiting is not a blocker. Use short checks, keep the user informed at least once per minute while active, and resume later from protocol state if the harness cannot stay awake.

Record nonterminal status when useful:

```bash
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" status plans/014-detail-forms --participant claude --status waiting
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" status plans/014-detail-forms --participant claude --status blocked --reason "Exact blocker"
```

Use `blocked` only for a genuine blocker under the harness's blocker rules.

## Semantic convergence

Plans have converged when they have no material difference in:

- goal, scope, and exclusions;
- user-visible behavior and constraints;
- architecture, ownership, data, migration, and compatibility decisions;
- implementation and review boundaries that affect dependencies, parallelism, risk, or rollback;
- acceptance criteria and verification;
- factual claims that affect implementation; and
- unresolved questions that require later evidence or user input.

Wording, heading order, examples, and equivalent task phrasing are not material differences. Declare `converged` only when you see no material improvement to absorb and no material correction the peer still needs. Both responses must say `converged` against the same exact draft pair.

After both converged responses exist, each participant records terminal status:

```bash
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" status plans/014-detail-forms --participant claude --status converged
```

The helper rejects terminal status without matching artifact evidence.

## Round limit

In round 005, use `converged` when no material difference remains. Otherwise use `round-limit` and list every remaining material difference. After both round-005 responses exist:

1. If both verdicts are `converged`, use the normal convergence path.
2. Otherwise, incorporate the final improvements you accept into `draft-006.md`.
3. Publish both draft-006 candidates without starting response round 006.
4. Record `round-limit` status for both participants.

The finalizer resolves the remaining differences using the shared prompt, repository evidence, and its best judgment. It records the rationale in the final plan where the decision affects implementation. The round limit ends the exchange; it does not pretend that the drafts converged.

## Finalizer selection

As soon as both participants have terminal status, both call:

```bash
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" claim-finalizer plans/014-detail-forms --participant claude
```

The lock makes the first successful claim atomic. The winner receives `"won": true` and becomes the only finalizer. The helper records the loser as `stopped`; the loser marks its persistent goal complete and performs no synthesis, export, branch, cleanup, or Git work.

A claim becomes stale after 15 minutes without a finalization heartbeat. The winner reruns `claim-finalizer` to renew the heartbeat if synthesis will take that long. If the winner disappears, the stopped participant calls `claim-finalizer` again. The helper atomically transfers a stale claim and records the recovery. A live claim never transfers.

## Final export

The finalizer chooses or combines the converged drafts, or resolves the draft-006 differences after the round limit. Write the plain final plan to a temporary file outside the repository. Do not include artifact metadata, response text, or EOF markers.

Then export and push it:

```bash
node "$HOME/.claude/skills/converge-plans/scripts/converge-plans.ts" finalize plans/014-detail-forms --participant claude --file /tmp/plan.md --push
```

`finalize` requires the finalizer claim and a clean `main` worktree. It validates the plan, creates a new commit whose parent is current `main`, and fast-forwards `main` to that commit. The commit contains only `plans/NNN-name/plan.md`. It does not merge, cherry-pick, copy, or replay the `plan-NNN` history. The convergence directory, protocol state, artifacts, and their commits remain on `plan-NNN` as the audit trail and do not appear on `main`.

If `finalize` fails because `main` is dirty or moved concurrently, report the exact condition and retry only after it is safe. Never work around the guard with ad hoc Git commands.

The winner marks its persistent goal complete only after `finalize --push` succeeds. Report the final `plan.md` path, main commit, plan branch, convergence outcome, and any questions that still require user input. Beads task creation remains paused until the user approves the final plan.
