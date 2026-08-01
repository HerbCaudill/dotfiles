import { basename } from "node:path"
import { getSessionTitle } from "./get-session-title.ts"
import type { Session } from "./types.ts"

/** Render session summaries as compact agent-readable text. */
export function renderSessionList(
  /** Normalized sessions. */
  sessions: Session[],
) {
  if (sessions.length === 0) return "No matching sessions found."

  return sessions
    .map(session => {
      const updated = session.updatedAt.toISOString().replace("T", " ").slice(0, 16)
      const cwd = session.cwd ? basename(session.cwd) : "-"

      return `${updated}  ${session.provider.padEnd(6)}  ${session.id}  ${cwd}  ${getSessionTitle(session)}`
    })
    .join("\n")
}
