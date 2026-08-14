import { basename } from "node:path"
import { getFirstMessageTime, getLastMessageTime } from "./filter-session-by-time.ts"
import { getSessionTitle } from "./get-session-title.ts"
import { formatLocalDateTime } from "./parse-time-window.ts"
import { renderMessages } from "./render-messages.ts"
import type { Session, TimeWindow } from "./types.ts"

/** Render time-filtered activity grouped by session. */
export function renderActivity(
  /** Sessions containing messages in the requested window. */
  sessions: Session[],
  /** Requested time window. */
  window: TimeWindow,
) {
  const output = [`# Activity for ${window.label}`]
  if (sessions.length === 0) return [...output, "", "No matching activity found."].join("\n")

  for (const session of sessions) {
    const cwd = session.cwd ? basename(session.cwd) : "unknown project"
    const first = getFirstMessageTime(session)
    const last = getLastMessageTime(session)
    output.push(
      "",
      `## ${cwd} — ${session.provider} — ${session.id}`,
      "",
      `- Prompt: ${getSessionTitle(session)}`,
      `- Working directory: ${session.cwd ?? "unknown"}`,
      `- Activity: ${first ? formatLocalDateTime(new Date(first)) : "unknown"} to ${last ? formatLocalDateTime(new Date(last)) : "unknown"}`,
    )
    if (session.untimestampedMessagesOmitted) {
      output.push(`- Untimestamped messages omitted: ${session.untimestampedMessagesOmitted}`)
    }
    output.push(...renderMessages(session.messages, 3, true))
  }

  return output.join("\n")
}

/** Serialize time-filtered activity for programmatic consumers. */
export function renderActivityJson(
  /** Sessions containing messages in the requested window. */
  sessions: Session[],
  /** Requested time window. */
  window: TimeWindow,
) {
  return JSON.stringify(
    {
      period: {
        label: window.label,
        since: window.since?.toISOString(),
        until: window.until?.toISOString(),
      },
      sessions: sessions.map(session => ({
        ...session,
        fileModifiedAt: session.fileModifiedAt.toISOString(),
      })),
    },
    null,
    2,
  )
}
