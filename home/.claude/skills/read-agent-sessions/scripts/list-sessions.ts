import { statSync } from "node:fs"
import { arePathsEqual } from "./are-paths-equal.ts"
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
) {
  if (timeWindow) {
    return findSessionsInTimeWindow(source, cwd, includeArchived, false, timeWindow)
      .sort((left, right) => (getLastMessageTime(right) ?? 0) - (getLastMessageTime(left) ?? 0))
      .slice(0, limit)
  }

  const sessions: Session[] = []
  const files = findSessionFiles(source, includeArchived).sort(
    (left, right) => statSync(right.path).mtimeMs - statSync(left.path).mtimeMs,
  )

  for (const file of files) {
    const session = getSessionSummary(file)
    if (cwd && (!session.cwd || !arePathsEqual(session.cwd, cwd))) continue

    sessions.push(session)
    if (sessions.length === limit) break
  }

  return sessions
}
