import { spawnSync } from "node:child_process"

import type { GithubNotification } from "./types.ts"

/** Fetch GitHub notifications that may need corresponding Google Tasks. */
export async function listGithubNotifications(
  /** The timestamp cursor for incremental polling. */
  lastCheckedAt: string | null,
): Promise<GithubNotification[]> {
  const args = [
    "api",
    "/notifications",
    "--method",
    "GET",
    "-f",
    "per_page=100",
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
  ]

  if (lastCheckedAt) {
    args.push("-f", "all=true", "-f", `since=${lastCheckedAt}`)
  }

  const result = spawnSync("gh", args, {
    encoding: "utf8",
  })

  if (result.status !== 0) {
    const output =
      result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status ?? "unknown"}`
    throw new Error(`gh notifications sync failed: ${output}`)
  }

  const parsedNotifications = JSON.parse(result.stdout) as unknown
  return Array.isArray(parsedNotifications) ? (parsedNotifications as GithubNotification[]) : []
}
