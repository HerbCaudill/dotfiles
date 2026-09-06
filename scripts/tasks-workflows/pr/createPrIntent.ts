import { createHash } from "node:crypto"
import type { PrIntent } from "./types.ts"

/** Freeze the first notification input before any potentially ambiguous Tasks call. */
export function createPrIntent(
  /** Existing notification event identity. */
  eventKey: string,
  /** Original title and PR URL prepared from the notification. */
  task: { title: string; notes: string },
): PrIntent {
  const hash = createHash("sha256").update(eventKey).digest("hex")
  return {
    eventKey,
    ...task,
    phase: "prepared",
    captureRequestId: `github-pr:capture:${hash}`,
    descriptionRequestId: `github-pr:description:${hash}`,
  }
}
