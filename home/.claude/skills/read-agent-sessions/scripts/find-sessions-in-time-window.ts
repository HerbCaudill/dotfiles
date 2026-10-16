import { statSync } from "node:fs"
import { readTranscriptFile } from "./read-transcript-file.ts"
import { matchesSessionDirectory } from "./matches-session-directory.ts"
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
  /** Repository path beneath Code on either machine. */
  project?: string,
) {
  return findSessionFiles(source, includeArchived)
    .filter(file => {
      if (file.summary && !matchesSessionDirectory(file.summary.cwd, cwd, project)) return false
      if (!window.since) return true
      return (file.fileModifiedAt ?? statSync(file.path).mtime).getTime() >= window.since.getTime()
    })
    .flatMap(file => {
      const stats = statSync(file.path)
      const session = parseSession(
        file,
        readTranscriptFile(file),
        includeTools,
        file.fileModifiedAt ?? stats.mtime,
      )
      if (!matchesSessionDirectory(session.cwd, cwd, project)) return []

      const filtered = filterSessionByTime(session, window)
      return filtered.messages.length > 0 ? [filtered] : []
    })
    .sort((left, right) => (getFirstMessageTime(left) ?? 0) - (getFirstMessageTime(right) ?? 0))
}
