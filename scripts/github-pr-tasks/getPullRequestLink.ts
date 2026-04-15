/** Convert a GitHub API pull request URL into a browser URL. */
export function getPullRequestLink(
  /** The GitHub subject URL. */
  url: string | null,
): string {
  if (!url) {
    return ""
  }

  const match = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/)

  if (!match) {
    return url
  }

  const [, owner, repo, pullNumber] = match
  return `https://github.com/${owner}/${repo}/pull/${pullNumber}`
}
