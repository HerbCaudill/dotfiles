---
name: queue-visual-reviews
description: Use when Herb asks to queue up routes of the devresults-next web app for visual review. Picks routes that are in progress or unreviewed and have no active thread, then launches one T3 thread per route that polishes the page and shows before and after screenshots.
---

# Queue visual reviews

Herb is working through visual reviews of the new web app in `~/Code/DevResults/devresults-next`. Each route gets its own T3 thread. The thread reviews the page, fixes what it can, pushes to main, then shows Herb before and after screenshots and waits for his feedback. This skill is short-lived: delete it when the review push is over.

The visual review records live in `tests/e2e/coverage/reviews` (see "Visual reviews" in `tests/e2e/coverage/README.md`). A route is `reviewed` once Herb approves it, `in-progress` once he has given feedback that's still being worked on, and has no `visual` entry before anyone has looked.

## 1. List candidates

```sh
node --experimental-strip-types ~/.claude/skills/queue-visual-reviews/scripts/candidates.mts
```

It fetches origin and prints the routes that are in progress or have no visual review on origin/main, plus the files with uncommitted changes in the main checkout. Add `--json` for machine-readable output.

## 2. Leave out routes that already have a thread

List threads in the devresults-next project (`t3_thread_list`, both unsettled and settled, and `titleContains: "Visual review"`), and also scan the other unsettled threads' titles for page names. A route has an active session when an unsettled thread covers it, whether a visual review thread or other work on the page, such as "Polish the logic checks index and detail pages". When a title doesn't say which route, read the thread's first message: the route key is in it. Treat a recently settled thread for a route that still shows as unreviewed as finished but not yet recorded, and leave the route out.

Also leave out:

- routes whose page files have uncommitted changes in the main checkout (another agent is mid-change);
- routes on a feature that's being redesigned right now (check the last day of `git log origin/main`);
- developer-only pages such as the grid playground.

## 3. Pick the routes

Herb says how many (it was 20 last time). Take every in-progress route without an active session first, then fill up with unreviewed routes. Prefer `implemented` routes and pages people use often, and group siblings (an index and its detail page) so they land in the same batch. If fewer routes qualify than he asked for, say so rather than padding with excluded ones.

For each route, find its title and, where you can, its new-app path in `apps/web/src/routing/routeManifest.ts`: the route key is a `legacyAliases` or `legacyCanonicalPath` entry, with `$` standing for an ID segment. If you can't find the path quickly, leave it out; the thread works it out.

## 4. Launch one thread per route

Use `t3_thread_launch` for each route, all in one parallel batch:

- `title`: `Visual review: <short page name>`, in sentence case.
- `clientRequestId`: `vr-<date>-<nn>`.
- `modelSelection`: `{ instanceId: "claudeAgent", model: "claude-opus-5-5", options: [{ id: "effort", value: "high" }] }` (the `default` role in the global model roles table; use whatever that table says now).
- `runtimeMode`: `full-access`.
- `workspaceStrategy`: `{ type: "worktree", baseRef: "origin/main", startFromOrigin: true, branch: "visual-review/<slug>" }`. Each thread gets its own worktree, so 20 agents don't collide in the main checkout.
- `message`: [brief.md](brief.md) with its placeholders filled:
  - `{TITLE}`: the page name, such as "Group detail" or "Project reporting period – Forms tab".
  - `{ROUTE_KEY}`: the route key.
  - `{NEW_APP_PATH}`: `, new-app path \`/groups/:groupId\`` when known; otherwise leave it empty and add "Find its new-app path in `apps/web/src/routing/routeManifest.ts` (the route key is its legacy path or alias)." to the route notes.
  - `{STATUS_LINE}`: "It has no visual review yet." or, for an in-progress route, "Herb has already given feedback on it: <notes from the record>. Read any earlier thread for this route before starting."
  - `{ROUTE_NOTES}`: anything that thread needs to know, such as:
    - a sibling page another thread in this batch or an active thread covers, so it leaves that page alone or keeps shared-component commits small;
    - files with uncommitted work in the main checkout that it must not touch;
    - a feature flag the page needs (check `features:` in the route manifest), with a warning not to change shared loura data;
    - for `/sys/*` pages, that it may need a loura account with system access.

## 5. Report back

Check that one thread has started and created its worktree (`t3_thread_read` with `view: "activity"`). Then reply with each thread's `link`, grouped by area, and say which in-progress routes already had a thread and what you left out and why. Don't wait for the threads to finish.
