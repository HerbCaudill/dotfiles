import { statSync } from "node:fs"
import { matchesSessionDirectory } from "./matches-session-directory.ts"
import { getLastMessageTime } from "./filter-session-by-time.ts"
import { findSessionFiles } from "./find-session-files.ts"
import { findSessionsInTimeWindow } from "./find-sessions-in-time-window.ts"
import { getSessionSummary } from "./get-session-summary.ts"
import type { Provider, Session, TimeWindow } from "./types.ts"

/** List recent sessions with normalized metadata. */
export function listSessions(
  /** Harness filter. */
  source: Provider | "all",
  /** Exact working-directory filter. */
  cwd: string | undefined,
  /** Maximum results. */
  limit: number,
  /** Whether to include archived Codex sessions. */
  includeArchived: boolean,
  /** Optional message-level time filter. */
  timeWindow?: TimeWindow,
  /** Repository path beneath Code on either machine. */
  project?: string,
) {
  if (timeWindow) {
    return findSessionsInTimeWindow(source, cwd, includeArchived, false, timeWindow, project)
      .sort((left, right) => (getLastMessageTime(right) ?? 0) - (getLastMessageTime(left) ?? 0))
      .slice(0, limit)
  }

  const sessions: Session[] = []
  const files = findSessionFiles(source, includeArchived).sort(
    (left, right) =>
      (right.fileModifiedAt ?? statSync(right.path).mtime).getTime() -
      (left.fileModifiedAt ?? statSync(left.path).mtime).getTime(),
  )

  for (const file of files) {
    const session = getSessionSummary(file)
    if (!matchesSessionDirectory(session.cwd, cwd, project)) continue

    sessions.push(session)
    if (sessions.length === limit) break
  }

  return sessions
}
