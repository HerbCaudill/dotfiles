import { spawnSync } from "node:child_process"

/** Find PR URLs in open tasks across every list, including tasks moved out of the default list. */
export async function listOpenPullRequestLinks(): Promise<string[]> {
  const lists = listPages<{ id: string }>("tasklists", { maxResults: 1000 })
  return lists.flatMap(list =>
    listPages<{ notes?: string }>("tasks", {
      tasklist: list.id,
      maxResults: 100,
      showCompleted: false,
      showDeleted: false,
      showHidden: false,
    }).flatMap(
      task => task.notes?.match(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+\b/g) ?? [],
    ),
  )
}

/** Read every page and fail before creating tasks if the existing tasks cannot be checked. */
function listPages<T>(
  /** Google Tasks collection to list. */
  resource: "tasklists" | "tasks",
  /** Filters for the collection. */
  params: Record<string, string | number | boolean>,
): T[] {
  const items: T[] = []
  let pageToken: string | undefined
  do {
    const result = spawnSync(
      "gws-delegated",
      ["tasks", resource, "list", "--params", JSON.stringify({ ...params, pageToken })],
      { encoding: "utf8" },
    )
    if (result.status !== 0) {
      const output =
        result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status ?? "unknown"}`
      throw new Error(`delegated gws task lookup failed: ${output}`)
    }
    const page = JSON.parse(result.stdout) as {
      /** Entries returned by this page. */
      items?: T[]
      /** Cursor for the next page. */
      nextPageToken?: string
    }
    items.push(...(page.items ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return items
}
