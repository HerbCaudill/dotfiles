import { readFileSync, statSync } from "node:fs"
import { arePathsEqual } from "./are-paths-equal.ts"
import { filterSessionByTime, getLastMessageTime } from "./filter-session-by-time.ts"
import { findMatchingSessionFiles } from "./find-matching-session-files.ts"
import { findSessionFiles } from "./find-session-files.ts"
import { parseSession } from "./parse-session.ts"
import type { Provider, Session, TimeWindow } from "./types.ts"

/** Search normalized user-visible conversation text. */
export function searchSessions(
  /** Literal case-insensitive search query. */
  query: string,
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
  const normalizedQuery = query.toLocaleLowerCase()
  const sessions: Session[] = []
  const candidates = findMatchingSessionFiles(
    findSessionFiles(source, includeArchived),
    query,
  ).sort((left, right) => statSync(right.path).mtimeMs - statSync(left.path).mtimeMs)

  for (const file of candidates) {
    const stats = statSync(file.path)
    const session = parseSession(file, readFileSync(file.path, "utf8"), false, stats.mtime)
    if (cwd && (!session.cwd || !arePathsEqual(session.cwd, cwd))) continue
    const candidate = timeWindow ? filterSessionByTime(session, timeWindow) : session
    if (
      !candidate.messages.some(message =>
        message.text.toLocaleLowerCase().includes(normalizedQuery),
      )
    ) {
      continue
    }

    sessions.push(candidate)
  }

  return sessions
    .sort((left, right) => {
      if (!timeWindow) return right.fileModifiedAt.getTime() - left.fileModifiedAt.getTime()
      return (getLastMessageTime(right) ?? 0) - (getLastMessageTime(left) ?? 0)
    })
    .slice(0, limit)
}
