---
name: github-discussion
description: Use when the user shares a GitHub discussion URL and wants its content pulled into context. Handles both repo discussions (github.com/owner/repo/discussions/N) and org discussions (github.com/orgs/org/discussions/N).
---

# GitHub Discussion

Pull a GitHub discussion (title, body, and comments) into context using `gh api graphql`.

## Repo discussions

URL pattern: `https://github.com/{owner}/{repo}/discussions/{number}`

```bash
gh api graphql -f query='
{
  repository(owner: "{owner}", name: "{repo}") {
    discussion(number: {number}) {
      title
      body
      comments(first: 50) {
        nodes {
          author { login }
          body
          createdAt
        }
      }
    }
  }
}'
```

## Org discussions

URL pattern: `https://github.com/orgs/{org}/discussions/{number}`

Org discussions live in a repo with `hasDiscussionsEnabled: true`. The API has no `organization.discussion` field, so you need to find the host repo first.

**Step 1** — find repos with discussions enabled:

```bash
gh api graphql -f query='
{
  organization(login: "{org}") {
    repositories(first: 100) {
      nodes { name hasDiscussionsEnabled }
    }
  }
}'
```

**Step 2** — query each matching repo for the discussion number (usually only 1-3 repos have it enabled; try them until one resolves).

Use the same repo discussion query from above with each candidate.
