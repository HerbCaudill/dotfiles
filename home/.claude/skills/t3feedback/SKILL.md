---
name: t3feedback
description: Use when Herb complains about, reports a problem with, or suggests a change to T3 Code. Turns the complaint into the right GitHub action on pingdotgg/t3code – an upvote on an existing report, a bug issue, an Ideas discussion, a Q&A question, or a small fix PR.
---

# T3 Code feedback

Herb will often just vent ("the composer ate my message again"). Your job is to work out what he means, find out whether the project already knows about it, and take the right action on `pingdotgg/t3code`.

The project's rules live in its `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/`. Re-read them with `gh api` if anything below seems out of date; theirs win.

## 1. Understand the complaint

Restate the problem in one or two sentences. Ask one question at a time only when you can't classify it or can't write a useful report without the answer, such as missing repro steps for a bug.

Gather what you can without asking:

- Installed version: ask Herb only if you can't find it in T3 Code's settings or in the installed app bundle (for example, `defaults read "/Applications/T3 Code.app/Contents/Info" CFBundleShortVersionString` on macOS – check the actual app name first).
- Environment: OS and version (`sw_vers`), provider and model if relevant.
- Logs, if the problem left traces. For bugs that need a real investigation of the machine, suggest Herb run `npx t3 triage`, which is the project's agent-driven bug filer, instead of doing it here.

## 2. Classify it

| It is…                                                                | Action                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Broken behavior, a regression, a crash, or unreliability              | Bug issue                                                             |
| A feature request, a change to intended behavior, or a design opinion | Ideas discussion                                                      |
| "How do I…" or "is this supposed to…"                                 | Q&A discussion, or just answer it if the docs or source make it clear |
| A small, obvious bug with a fix that's clearly correct                | Bug issue, then optionally a PR                                       |

Calling a behavior change a bug doesn't make it one. If the app does what it was designed to do and Herb wants it to do something else, it's an idea.

## 3. Search for duplicates

Always search before creating anything. Try a few phrasings, including the words the UI uses.

```bash
gh search issues --repo pingdotgg/t3code --state open "<keywords>" --limit 20
gh search issues --repo pingdotgg/t3code --state closed "<keywords>" --limit 10
gh api graphql -f query='{ search(query: "repo:pingdotgg/t3code <keywords>", type: DISCUSSION, first: 20) { nodes { ... on Discussion { number title url category { name } upvoteCount closed } } } }'
```

Read the likely matches (`gh issue view <n> --repo pingdotgg/t3code --comments`) before deciding. A closed issue fixed in a newer release means Herb should update, not report.

## 4. Propose, then act

Posting on GitHub is public and attributed to Herb. Show him a draft and the chosen action, and wait for his go-ahead before any write. Keep the draft in his voice: plain, specific, no AI polish.

### Existing match: +1

Upvote rather than commenting "+1".

- Issue: `gh api -X POST repos/pingdotgg/t3code/issues/<n>/reactions -f content=+1`
- Discussion: get its node ID, then `gh api graphql -f query='mutation { addUpvote(input: {subjectId: "<id>"}) { subject { upvoteCount } } }'`

Add a comment only when Herb's case adds something new: a different repro, environment, version, or workaround.

### Bug issue

Follow `bug_report.yml`. Its fields are: Area (`apps/web`, `apps/server`, `apps/desktop`, `apps/mobile`, `packages/contracts or packages/shared`, `Build, CI, or release tooling`, `Docs`, `Not sure`), Steps to reproduce, Expected behavior, Actual behavior, Impact (`Blocks work completely`, `Major degradation or frequent failure`, `Minor bug or occasional failure`, `Cosmetic issue`), Version or commit, Environment, Logs or stack traces, and Workaround. One problem per issue. Redact secrets and home directory paths.

`gh issue create` can't fill form templates, so write the body as Markdown with a `### <field label>` heading per field, and include the template's checklist items as checked boxes:

```bash
gh issue create --repo pingdotgg/t3code --title "[Bug]: <summary>" --label bug --label needs-triage --body-file <file>
```

If the labels are rejected for lack of permission, retry without them.

### Ideas or Q&A discussion

Describe the problem first, then the proposed change, then why the current behavior falls short. Mention any workaround. Create it with GraphQL:

```bash
gh api graphql -f query='{ repository(owner: "pingdotgg", name: "t3code") { id discussionCategories(first: 20) { nodes { id slug } } } }'
gh api graphql -f query='mutation($repo: ID!, $cat: ID!, $title: String!, $body: String!) { createDiscussion(input: {repositoryId: $repo, categoryId: $cat, title: $title, body: $body}) { discussion { url } } }' -f repo=<repoId> -f cat=<ideas or q-a id> -f title='<title>' -f body="$(cat <file>)"
```

### PR

The maintainers aren't seeking outside contributions. Offer a PR only for a very small, focused fix to an obvious bug, and only if Herb wants one. Anything that changes intended behavior needs a maintainer-approved Ideas discussion first; link that approval in the PR.

If Herb wants a PR:

1. Fork and clone into `~/Code/HerbCaudill/t3code` if not already there (`gh repo fork pingdotgg/t3code --clone`), and follow its `AGENTS.md`.
2. Fix one underlying problem. Include its tests.
3. Write the PR body with the defect, why it qualifies as a small obvious fix (or the link to the approval), how you reproduced it, how you checked the fix, what you observed, and what you couldn't check. UI changes need before-and-after screenshots; use the `video-evidence` skill for recordings.
4. Use the `opening-prs` skill to open it against `pingdotgg/t3code:main`, and link the related issue.

## 5. Report back

Give Herb the link and one line on what you did. If you only upvoted, say which existing issue or discussion matched and why.
