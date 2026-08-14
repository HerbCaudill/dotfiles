import { readFileSync, statSync } from "node:fs"
import { filterSessionByTime } from "./filter-session-by-time.ts"
import { parseSession } from "./parse-session.ts"
import { resolveSessionFile } from "./resolve-session-file.ts"
import type { Provider, TimeWindow } from "./types.ts"

/** Read and normalize one complete transcript. */
export function readSession(
  /** Path, ID, or ID prefix. */
  value: string,
  /** Harness filter. */
  source: Provider | "all",
  /** Whether to retain tool traffic. */
  includeTools: boolean,
  /** Optional message-level time filter. */
  timeWindow?: TimeWindow,
) {
  const file = resolveSessionFile(value, source)
  const stats = statSync(file.path)

  const session = parseSession(file, readFileSync(file.path, "utf8"), includeTools, stats.mtime)
  return timeWindow ? filterSessionByTime(session, timeWindow) : session
}
