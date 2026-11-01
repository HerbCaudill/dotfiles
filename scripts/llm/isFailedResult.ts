import type { ProcessResult } from "./types.ts"

/** Check whether a run failed, including Claude's errors reported inside a zero exit. */
export function isFailedResult(
  /** The finished run. */
  result: ProcessResult,
): boolean {
  if (result.code !== 0) return true
  return /^\s*\{/.test(result.stdout) && /"is_error"\s*:\s*true/.test(result.stdout)
}
