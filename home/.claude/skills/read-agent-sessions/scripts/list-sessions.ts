import { statSync } from "node:fs"
import { arePathsEqual } from "./are-paths-equal.ts"
import { findSessionFiles } from "./find-session-files.ts"
import { getSessionSummary } from "./get-session-summary.ts"
import type { Provider, Session } from "./types.ts"

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
) {
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
