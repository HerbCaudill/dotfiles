import type { Session, TimeWindow } from "./types.ts"

/** Keep only timestamped session messages inside a requested time window. */
export function filterSessionByTime(
  /** Session to filter. */
  session: Session,
  /** Inclusive start and exclusive end. */
  window: TimeWindow,
): Session {
  let untimestampedMessagesOmitted = 0
  const messages = session.messages.filter(message => {
    if (!message.timestamp) {
      untimestampedMessagesOmitted++
      return false
    }

    const timestamp = Date.parse(message.timestamp)
    if (Number.isNaN(timestamp)) {
      untimestampedMessagesOmitted++
      return false
    }

    if (window.since && timestamp < window.since.getTime()) return false
    if (window.until && timestamp >= window.until.getTime()) return false
    return true
  })

  return {
    ...session,
    messages,
    ...(untimestampedMessagesOmitted > 0 ? { untimestampedMessagesOmitted } : {}),
  }
}

/** Get the first valid message timestamp in a session. */
export function getFirstMessageTime(
  /** Session whose messages should be inspected. */
  session: Session,
) {
  return getMessageTimes(session)[0]
}

/** Get the last valid message timestamp in a session. */
export function getLastMessageTime(
  /** Session whose messages should be inspected. */
  session: Session,
) {
  return getMessageTimes(session).at(-1)
}

/** Collect valid event times in source order. */
function getMessageTimes(session: Session) {
  return session.messages.flatMap(message => {
    if (!message.timestamp) return []
    const timestamp = Date.parse(message.timestamp)
    return Number.isNaN(timestamp) ? [] : [timestamp]
  })
}
