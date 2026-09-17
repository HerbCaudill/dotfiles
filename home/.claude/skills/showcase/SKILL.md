---
name: showcase
description: "Guide a human through a committed code change"
---

# Showcase

Help the user understand one committed change by demonstrating the existing behavior, demonstrating the new behavior, then walking through the code. Each stage ends with a hard checkpoint: wait for the user before continuing. Guide understanding without turning the session into a code review, exhaustive testing, or a pass/fail judgment.

## Prepare

Follow applicable global instructions, repository instructions, and environment skills before Git, build, runtime, database, authentication, or browser work. They govern those mechanics; this skill governs the walkthrough. For DevResults, use the `devresults` skill.

Record the starting branch or detached commit and relevant runtime state. Resolve the target and code baseline:

| Target | Default baseline | Target revision |
| --- | --- | --- |
| Pull request | Merge base with the PR's base branch | PR head |
| Branch | Merge base with its inferred base branch | Branch head |
| Single commit | First parent | The commit |
| Commit range | Range start | Range end |

The code baseline defines the diff for stage 3. The site used to demonstrate existing behavior may run a different revision if it exhibits the relevant old behavior and differences in data, permissions, configuration, or intervening changes do not invalidate the comparison. Identify that site and its revision when available; never describe it as the exact code baseline without verification.

Briefly announce the change, the source of its intent, the problem, the intended outcome, what would count as success, the exact diff revisions, and the sites used for the demonstration. Choose one headline scenario and only the high-risk edge cases needed to understand it.

Demonstrate real behavior: a local browser UI, an API request and response, command or job output, or an opened artifact. For an internal refactor, use a focused test or caller to demonstrate unchanged public behavior. Do not substitute screenshots or narration when the real behavior is available.

### Example state

Prefer existing local data. If setup is missing, guide the user through it in the product UI. Handle routine navigation; let the user perform meaningful setup and demonstration actions unless they delegate them.

Create fixtures automatically only when necessary and manual setup is impractical. Prefer the UI, then an API; write directly to the database only when project guidance permits it and no practical higher-level path exists. Use equivalent starting states before and after, resetting state, using paired records, or following the project's data-isolation method so the baseline demonstration cannot contaminate the target demonstration.

### Checkout and runtime

Choose the site for existing behavior in this order:

1. Reuse an already-running primary local site when it exhibits the relevant old behavior. Do not switch its branch, rebuild it, or restart it for the showcase.
2. Use the live app when suitable, especially for read-only inspection and interactions. Demonstrations that change records, permissions, or workflows should use a suitable local environment.
3. Build the exact code baseline only when neither running site supports a valid comparison, intervening changes affect the scenario, or private, resettable baseline data is required.

Keep the target environment at the target revision. Prepare, build, and verify it before beginning stage 1 so the user's checkpoint advances directly to the prepared target. Keep both sites available for comparison where capacity permits. Multiple showcases may share a suitable existing-behavior site; coordinate any local data changes so demonstrations do not interfere with one another. Queue expensive builds within the shared machine's capacity.

If an exact baseline build is necessary and capacity prevents keeping both environments available, reuse one owned environment sequentially. Explain the constraint and expected transition before stage 1. This is a fallback, not the default. Stop or restart only owned affected processes, rebuild as required, and restore equivalent starting data before demonstrating the target.

Before each demonstration, verify starting data, application health, and runtime identity. Verify that the target serves the intended revision; a checkout alone does not prove runtime freshness. For an existing-behavior site, verify the relevant old behavior and record any limits on revision provenance.

### Showing browser pages

To show a page, launch Chrome from the command line. On macOS:

```bash
open -a "Google Chrome" "https://example.com/path"
```

Use browser control only when you also need to inspect or interact with the page. Open the user-facing page directly first, then attach to that tab when practical; extension-managed tabs can be hard for the user to find.

## Stage 1: Existing behavior

1. Show the verified existing-behavior site and explain the problem in plain language.
2. Open the exact page, request, command, or artifact. Give short numbered instructions with direct URLs or exact commands, explaining what to look for.
3. Describe only the result actually observed. If the old behavior cannot be reproduced, stop and explain what happened.

Wait for the user to confirm they understand the existing behavior and are ready for the change. Carry their questions and observations into the remaining walkthrough.

## Stage 2: New behavior

Open the prepared, verified target with equivalent starting state. Repeat the same path and meaningful action where possible. Explain what to do, what changed, what should happen, and any important edge cases.

If the target behavior does not appear, stop. Diagnose only far enough to identify stale runtime or incorrect preparation; do not silently fix product code. Claim success only after observing it in the fresh target runtime.

Wait for the user to confirm they have finished exercising the new behavior before opening the code walkthrough.

## Stage 3: Code walkthrough

Explain the diff between the announced revisions, connecting each section to the behavior just demonstrated:

1. Restate that behavior in one or two sentences.
2. Start at the UI, public API, command, or caller the user exercised. Follow it file by file through state, services, domain logic, persistence, and helpers as applicable.
3. Show tests beside the behavior they document. Summarize generated files, formatting, metadata, and mechanical changes. Use commit history only when it explains an implementation choice.

Open relevant diffs or source files as you go. Link to verified files in a local checkout containing the target revision, reusing an existing worktree when available. Use absolute Markdown paths and precise line numbers, such as `[Chart.ts](/Users/name/Code/project/Chart.ts:42)`, rather than `~`, GitHub URLs, or editor URI schemes.

Distinguish demonstrated code behavior, intent from authoritative sources, and inferred intent. Answer implementation questions, then pause for remaining questions before finishing. No formal review verdict is required.

## Finish or abort

If you changed an owned checkout's revision, restore its starting branch or detached commit even if the walkthrough stops early. Stop showcase-only processes as appropriate and restore the original owned runtime when project guidance makes that safe and practical. Leave shared existing-behavior runtimes in place. Offer to remove showcase fixtures; delete them only with confirmation.

Report the final checkout, runtime, and fixture state, including anything not restored. Publish notes, comments, approvals, or other external changes only on explicit request.

Throughout, lead with what the user should look at, keep instructions short enough to follow beside the product, and ask one blocking question at a time.
