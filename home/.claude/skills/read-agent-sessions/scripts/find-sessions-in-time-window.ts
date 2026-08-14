import { readFileSync, statSync } from "node:fs"
import { arePathsEqual } from "./are-paths-equal.ts"
import { filterSessionByTime, getFirstMessageTime } from "./filter-session-by-time.ts"
import { findSessionFiles } from "./find-session-files.ts"
import { parseSession } from "./parse-session.ts"
import type { Provider, TimeWindow } from "./types.ts"

/** Read sessions containing timestamped messages inside a requested window. */
export function findSessionsInTimeWindow(
  /** Harness filter. */
  source: Provider | "all",
  /** Exact working-directory filter. */
  cwd: string | undefined,
  /** Whether to include archived Codex sessions. */
  includeArchived: boolean,
  /** Whether to retain tool calls and results. */
  includeTools: boolean,
  /** Message-level time window. */
  window: TimeWindow,
) {
  return findSessionFiles(source, includeArchived)
    .filter(file => {
      if (!window.since) return true
      return statSync(file.path).mtimeMs >= window.since.getTime()
    })
    .flatMap(file => {
      const stats = statSync(file.path)
      const session = parseSession(file, readFileSync(file.path, "utf8"), includeTools, stats.mtime)
      if (cwd && (!session.cwd || !arePathsEqual(session.cwd, cwd))) return []

      const filtered = filterSessionByTime(session, window)
      return filtered.messages.length > 0 ? [filtered] : []
    })
    .sort((left, right) => (getFirstMessageTime(left) ?? 0) - (getFirstMessageTime(right) ?? 0))
}
