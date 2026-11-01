import type { ProcessResult } from "./types.ts"

/** Check whether a failed run stopped because a usage limit ran out. */
export function isUsageLimitFailure(
  /** The failed run. */
  result: ProcessResult,
): boolean {
  return USAGE_LIMIT_PATTERN.test(`${result.stdout}\n${result.stderr}`)
}

const USAGE_LIMIT_PATTERN =
  /usage limit|rate.?limit|hit your limit|limit reached|quota|too many requests|\b429\b/i
