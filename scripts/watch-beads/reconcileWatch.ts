import type { ReadyIssue, WatchSnapshot } from "./types.ts"

/** Notify only newly eligible work or waiting work whose capacity was released. */
export async function reconcileWatch(
  /** Previously delivered snapshot, including after a service restart. */
  previous: WatchSnapshot | undefined,
  /** Fresh blocker-aware Beads results. */
  issues: ReadyIssue[],
  /** Fresh in-progress issue IDs, read independently to catch ownership races. */
  active: string[],
  /** Deliver a wake-up; rejection leaves the previous snapshot retryable. */
  send: (ids: string[]) => Promise<void>,
): Promise<WatchSnapshot> {
  const ready = issues
    .filter(
      issue =>
        (!issue.status || issue.status === "open") &&
        issue.issue_type !== "epic" &&
        !issue.labels?.includes("human") &&
        !issue.assignee?.trim() &&
        !active.includes(issue.id),
    )
    .map(issue => issue.id)
    .sort()
  const newWork = ready.some(id => !previous?.ready.includes(id))
  const capacityReleased = previous?.active.some(id => !active.includes(id))
  if (ready.length && (newWork || capacityReleased)) await send(ready)
  return { ready, active: [...active].sort() }
}
