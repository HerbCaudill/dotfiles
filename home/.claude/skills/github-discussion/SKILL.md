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

**DevResults:** Org discussions are hosted in `DevResults/DevResults_Team`. Use `owner: "DevResults", name: "DevResults_Team"` with the repo query above.

**Other orgs** — find repos with discussions enabled, then try each:

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
