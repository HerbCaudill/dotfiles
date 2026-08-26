import { ARCHIVE_LABEL_MUTATION, PROMOTE_LABEL_MUTATION } from "./constants.ts"
import type { LabelMutation } from "./types.ts"

/** Accept only one of the two exact thread-level Gmail label deltas authorized by policy. */
export function validateLabelMutation(
  /** Proposed Gmail label mutation. */
  value: unknown,
): LabelMutation {
  if (
    isExactMutation(value, ARCHIVE_LABEL_MUTATION) ||
    isExactMutation(value, PROMOTE_LABEL_MUTATION)
  ) {
    return value
  }
  throw new Error("Unauthorized Gmail label mutation")
}

/** Compare an unknown value to one exact mutation without coercion. */
function isExactMutation(
  /** Unknown proposed mutation. */
  value: unknown,
  /** Authorized mutation. */
  allowed: LabelMutation,
): value is LabelMutation {
  if (!isRecord(value)) return false
  if (Object.keys(value).sort().join(",") !== "addLabelIds,removeLabelIds") return false
  return (
    arraysEqual(value.addLabelIds, allowed.addLabelIds) &&
    arraysEqual(value.removeLabelIds, allowed.removeLabelIds)
  )
}

/** Compare an unknown value to an exact string array. */
function arraysEqual(
  /** Unknown array. */
  value: unknown,
  /** Expected ordered strings. */
  expected: readonly string[],
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  )
}

/** Check whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
