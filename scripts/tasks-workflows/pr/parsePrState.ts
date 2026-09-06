import { createPrIntent } from "./createPrIntent.ts"
import type { PrIntent, PrState } from "./types.ts"

/** Validate checkpoint data without silently resetting or dropping historical fields. */
export function parsePrState(
  /** Parsed private JSON, which may predate Tasks intentions. */
  value: unknown,
): PrState {
  if (
    !isRecord(value) ||
    !(value.lastCheckedAt === null || isTimestamp(value.lastCheckedAt)) ||
    !Array.isArray(value.processedEventKeys) ||
    !value.processedEventKeys.every(key => typeof key === "string")
  )
    throw new Error("Invalid PR checkpoint; preserve it for inspection")
  const intents = value.intents ?? {}
  if (!isRecord(intents)) throw new Error("Invalid PR intention checkpoint")
  for (const [key, intent] of Object.entries(intents))
    if (!isIntent(intent, key)) throw new Error("Invalid PR intention checkpoint")
  return {
    ...value,
    lastCheckedAt: value.lastCheckedAt as string | null,
    processedEventKeys: [...value.processedEventKeys],
    intents: intents as Record<string, PrIntent>,
  }
}

/** JSON objects only; arrays cannot stand in for an identity index. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** A persisted cursor must be a real timestamp with an explicit zone. */
function isTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    return false
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value.slice(0, 10)
}

/** Refuse changed receipt identities and missing confirmed target IDs. */
function isIntent(value: unknown, key: string): value is PrIntent {
  if (
    !isRecord(value) ||
    value.eventKey !== key ||
    !key ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    typeof value.notes !== "string" ||
    !value.notes ||
    !["prepared", "captured", "saved"].includes(String(value.phase))
  )
    return false
  const expected = createPrIntent(key, { title: value.title, notes: value.notes })
  return (
    value.captureRequestId === expected.captureRequestId &&
    value.descriptionRequestId === expected.descriptionRequestId &&
    (value.phase === "prepared"
      ? value.taskId === undefined
      : typeof value.taskId === "string" && !!value.taskId)
  )
}
