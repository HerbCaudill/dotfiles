---
name: showcase
description: "Guide a human through a committed code change in three stages: demonstrate the existing behavior and problem, demonstrate the new behavior, then explain the implementation from the user-facing entry point down. Use when the user wants to see, demo, inspect, understand, or manually walk through a PR, branch, commit, or commit range. This is an interactive walkthrough, not a code review."
---

# Showcase

Help the user understand one change at a time by seeing it work before reading its code.

The three stages are:

1. Show the existing behavior and explain the problem.
2. Show the new behavior.
3. Walk through the code changes.

Pause after each stage. Do not continue until the user says they are ready.

## Scope

Accept one of these review targets:

- a pull request,
- a branch,
- a single commit, or
- a commit range.

Do not use this skill for staged or uncommitted changes. Require a clean working tree before starting. If the tree is dirty, stop and ask the user to commit, discard, or otherwise handle those changes themselves. Never stash, reset, clean, or discard their work.

This skill is primarily for UI changes, but it can demonstrate other observable behavior:

- For a web UI, use the local site and browser.
- For an API, make a real request and show the response.
- For a CLI or background job, run it and show its output.
- For an export or generated file, open the resulting artifact.
- For an internal refactor, use a focused test or caller to show that public behavior stays the same.

Review behavior and explain code. Do not perform an independent code review, hunt for defects, judge test coverage, suggest fixes, edit code, post review comments, approve, or merge. The user can request those tasks separately.

## Follow the project first

Before Git, build, server, database, or browser work:

1. Read the applicable global and repository instruction files.
2. Read and follow any applicable environment or repository skills.
3. Let that guidance determine the checkout, build, runtime, database, authentication, and browser mechanics.

This skill owns the walkthrough protocol, not project-specific development commands. For example, in DevResults, follow the `devresults` skill and the DevResults repository guidance for all branch, Windows VM, build, IIS, database, and browser work.

## Resolve the change

Record the starting branch or detached commit so it can be restored later. Then resolve and announce the target and baseline:

| Target        | Default baseline                         | Target revision |
| ------------- | ---------------------------------------- | --------------- |
| Pull request  | Merge base with the PR's base branch     | PR head commit  |
| Branch        | Merge base with its inferred base branch | Branch head     |
| Single commit | First parent                             | The commit      |
| Commit range  | Range start                              | Range end       |

Allow the user to override an inferred baseline. If a merge commit has more than one plausible baseline, explain the choice and ask before proceeding.

Gather the intent from the strongest available source: the user's request, PR description, linked issue, specification, commit message, and diff. Prefer authoritative sources over inference. If sources disagree or the intended behavior remains ambiguous, pause and resolve that before demonstrating anything.

Inspect the complete diff enough to identify the affected surfaces and trace the implementation later. This inspection is for explanation and scenario planning, not code review.

## Setup checkpoint

Before stage 1, give the user a short orientation:

- the change under review,
- the source of truth for its intent,
- the problem and intended outcome,
- the behavior that would count as success, and
- the exact baseline and target revisions.

If these points are clear, continue without asking for ceremonial confirmation. Pause only when the target, baseline, or intent needs a decision.

Plan a focused walkthrough rather than exhaustive manual testing. Use:

- one headline scenario that makes the problem and improvement clear, and
- only the highest-risk edge cases needed to understand the change.

Use the same logical scenario and equivalent starting state before and after. Mention additional test scenarios separately when useful, but do not turn the showcase into a regression-testing session.

## Prepare the example state

Prefer existing local example data that already demonstrates the behavior. If configuration or data is missing, guide the user through creating it in the product UI. Handle routine navigation, but let the user perform the meaningful setup action.

Create fixtures automatically only when they are strictly necessary and manual setup would be impractical. Before creating any records:

1. Describe exactly what will be created and why.
2. Explain whether the UI, an API, or the database will be used.
3. Give the records a unique searchable tag when the application permits it.
4. Ask for explicit confirmation.

Use the highest-level supported interface. Prefer the UI, then an API, and use direct database writes only when the applicable project guidance permits them and no practical higher-level path exists. Keep before and after states equivalent, verify each starting state, and do not let actions from stage 1 contaminate stage 2. Reset the state, use paired records, or follow the project's approved data-isolation method.

## Manage the checkout and runtime

Use the existing clean checkout sequentially unless project guidance requires another arrangement:

1. Record the starting checkout and relevant runtime state.
2. Stop or restart affected processes as project guidance requires.
3. Check out the baseline revision.
4. Build and start the baseline application.
5. After stage 1, check out the target revision.
6. Build and start the target application.
7. Restore the starting checkout when the showcase ends or is aborted.

Never assume that a running site matches the checked-out code. Before asking the user to inspect behavior, verify that the application is healthy and serves the intended revision. Follow project guidance to decide whether to rebuild the client, server, generated assets, dependencies, database, or some combination. Rebuild only what is needed, but prefer a known-fresh runtime over a fast stale one.

Tell the user before changing a shared local runtime. Do not reuse an unrelated runtime lane, database, or server merely because it is already running.

## Open pages in Chrome

When the goal is simply to show the user a page, launch Chrome directly from the command line with the URL. On macOS, use:

```bash
open -a "Google Chrome" "https://example.com/path"
```

Prefer this to opening the page through the browser-control extension. Extension-managed tabs can appear in a separate browser window or a collapsed tab group, which makes the handoff confusing. Use browser control only when the walkthrough also requires the agent to inspect or interact with the page. If both are needed, launch the user-facing page directly first, then attach browser control to that existing tab when practical.

## Stage 1: Existing behavior and problem

Check out and serve the baseline. Verify the starting state before handing control to the user.

Then:

1. Explain the current behavior and the problem in plain language.
2. Open the exact page, request, command, or artifact that demonstrates it.
3. Give a short numbered list of what the user should do and what to look for.
4. Handle routine navigation, but let the user perform the meaningful action unless they delegate it.
5. State the observed result without claiming anything the demonstration did not prove.

If the old behavior cannot be reproduced, stop and explain what was observed. Do not move on as though the premise were proven.

Wait for the user to confirm that they understand the existing behavior and are ready to see the change. Record their questions or observations for use during the walkthrough, but do not require a formal verdict.

## Stage 2: New behavior

Return the scenario to an equivalent starting state. Check out and serve the target revision, then verify runtime freshness and the starting state again.

Use the same path and meaningful action as stage 1 whenever possible. Tell the user:

- where they are,
- what to do,
- what changed,
- what should now happen, and
- which important details or edge cases deserve attention.

Do not substitute screenshots or a verbal description when the real local behavior can be shown. If the target behavior fails to appear, stop and diagnose only far enough to determine whether the showcase environment is stale or incorrectly prepared. Do not silently fix product code.

Wait for the user to confirm that they have finished exercising the new behavior before opening the code walkthrough.

## Stage 3: Code walkthrough

Explain the diff between the announced baseline and target. Keep the observed behavior from stages 1 and 2 as the organizing thread.

Link code to the exact local checkout or worktree that contains the target revision. Use Markdown links with full absolute filesystem paths and tight line numbers, for example `[Chart.ts](/Users/name/Code/project/Chart.ts:42)`. Prefer these local links to GitHub URLs or editor-specific URI schemes. Resolve `~` to the full home-directory path in the link target, and verify that each target exists before presenting it. Reuse an existing worktree for the target branch when one is available.

1. Re-state the behavior being explained in one or two sentences.
2. Start with the apex consumer: the UI, public API, command, or caller the user just exercised.
3. Go file by file from that entry point down through state, services, domain logic, persistence, and lower-level helpers as applicable.
4. Show tests beside the behavior they document.
5. Summarize generated files, formatting, project metadata, and mechanical changes instead of walking every line.
6. Use commit history only when it explains why the implementation took its current shape.

Open the relevant diff or source files as the explanation moves through them. Keep file ranges tight and connect each code section to behavior the user has already seen.

Clearly distinguish:

- what the code demonstrably does,
- intent stated in an authoritative source, and
- intent inferred from the implementation.

Answer questions about the implementation, but remain a guide. Do not turn the walkthrough into code-review findings or a pass/fail judgment.

## Finish and restore

When the user is done:

1. Answer any remaining questions.
2. Offer to clean up fixtures created for the showcase; delete them only with confirmation.
3. Stop processes started only for the showcase when appropriate.
4. Restore the original branch or detached commit.
5. Restore or restart the original runtime when project guidance makes that safe and practical.
6. Report the final checkout, runtime, and fixture state, including anything that could not be restored.

Do not require a final review outcome. Do not publish notes, comments, approvals, or other external state unless the user explicitly requests a separate action.

## Interaction rules

- Review one change at a time.
- Lead with what the user should look at, not a log of setup commands.
- Keep instructions short enough to follow while looking at the product.
- Give direct URLs or exact commands whenever possible.
- Ask only one blocking question at a time.
- Treat each stage boundary as a hard checkpoint.
- Never claim that behavior works until it has been observed in the fresh target runtime.
- Restore the starting checkout even when the walkthrough stops early.
