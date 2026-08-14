import { basename } from "node:path"
import { getLastMessageTime } from "./filter-session-by-time.ts"
import { getSessionTitle } from "./get-session-title.ts"
import { formatLocalDateTime } from "./parse-time-window.ts"
import type { Session } from "./types.ts"

/** Render session summaries as compact agent-readable text. */
export function renderSessionList(
  /** Normalized sessions. */
  sessions: Session[],
  /** Whether the list contains complete time-filtered messages. */
  useMessageTime = false,
) {
  if (sessions.length === 0) return "No matching sessions found."

  return sessions
    .map(session => {
      const lastMessageTime = getLastMessageTime(session)
      const activity =
        useMessageTime && lastMessageTime
          ? formatLocalDateTime(new Date(lastMessageTime)).slice(0, 16)
          : `modified ${formatLocalDateTime(session.fileModifiedAt).slice(0, 16)}`
      const cwd = session.cwd ? basename(session.cwd) : "-"

      return `${activity}  ${session.provider.padEnd(6)}  ${session.id}  ${cwd}  ${getSessionTitle(session)}`
    })
    .join("\n")
}
