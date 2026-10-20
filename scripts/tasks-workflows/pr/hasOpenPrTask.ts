import type { TasksCall } from "./types.ts"

/** Search every page for an unfinished task whose title or description links this exact PR. */
export async function hasOpenPrTask(
  /** Browser URL of the PR, as saved in captured task descriptions. */
  link: string,
  /** Bound Tasks CLI; an unavailable read defers the batch rather than risking a duplicate. */
  call: TasksCall,
): Promise<boolean> {
  if (!link) return false
  // Reject longer PR numbers that share this URL as a prefix, such as /pull/74 within /pull/7432.
  const exact = new RegExp(`${link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`)
  let continuation: string | null | undefined
  do {
    const response = await call("search", {
      text: link,
      kind: "task",
      ...(continuation ? { continuation } : {}),
    })
    if (response.status !== "ok" || !response.result)
      throw new Error(`Tasks ${response.status}: PR task lookup deferred`)
    if (
      response.result.items?.some(
        item =>
          item.kind === "task" &&
          item.status !== "done" &&
          exact.test(`${item.title ?? ""}\n${item.description ?? ""}`),
      )
    )
      return true
    continuation = response.result.continuation
  } while (continuation)
  return false
}
