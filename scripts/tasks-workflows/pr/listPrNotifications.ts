import { runGithubCommand } from "./runGithubCommand.ts"
import type { GithubNotification } from "../../github-pr-tasks/types.ts"

/** Read all notification pages before allowing the poll cursor to advance. */
export async function listPrNotifications(
  /** Previous complete poll boundary. */
  since: string | null,
  /** Read-only GitHub process boundary, replaced by fixtures in tests. */
  run = runGithubCommand,
): Promise<GithubNotification[]> {
  const args = [
    "api",
    "/notifications",
    "--method",
    "GET",
    "-f",
    "per_page=100",
    "--paginate",
    "--slurp",
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
    ...(since ? ["-f", "all=true", "-f", `since=${since}`] : []),
  ]
  const pages: unknown = JSON.parse(await run(args))
  if (!Array.isArray(pages) || !pages.length || !pages.every(Array.isArray))
    throw new Error("Invalid GitHub notification pages")
  const records: unknown[] = pages.flat()
  if (!records.every(isNotification)) throw new Error("Invalid GitHub notification record")
  return records
}

/** Validate every record before a malformed response can erase a polling interval. */
function isNotification(value: unknown): value is GithubNotification {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.reason !== "string" ||
    typeof record.updated_at !== "string" ||
    Number.isNaN(Date.parse(record.updated_at)) ||
    !record.subject ||
    typeof record.subject !== "object"
  )
    return false
  const subject = record.subject as Record<string, unknown>
  return (
    typeof subject.title === "string" &&
    typeof subject.type === "string" &&
    (subject.url === null || typeof subject.url === "string")
  )
}
