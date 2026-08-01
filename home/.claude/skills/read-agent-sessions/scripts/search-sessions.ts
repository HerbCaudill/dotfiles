import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { findMatchingSessionFiles } from "./find-matching-session-files.ts"
import { findSessionFiles } from "./find-session-files.ts"
import { parseSession } from "./parse-session.ts"
import type { Provider, Session } from "./types.ts"

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
) {
  const normalizedQuery = query.toLocaleLowerCase()
  const expectedCwd = cwd ? resolve(cwd) : undefined
  const sessions: Session[] = []
  const candidates = findMatchingSessionFiles(
    findSessionFiles(source, includeArchived),
    query,
  ).sort((left, right) => statSync(right.path).mtimeMs - statSync(left.path).mtimeMs)

  for (const file of candidates) {
    const stats = statSync(file.path)
    const session = parseSession(file, readFileSync(file.path, "utf8"), false, stats.mtime)
    if (expectedCwd && session.cwd !== expectedCwd) continue
    if (
      !session.messages.some(message => message.text.toLocaleLowerCase().includes(normalizedQuery))
    ) {
      continue
    }

    sessions.push(session)
    if (sessions.length === limit) break
  }

  return sessions
}
