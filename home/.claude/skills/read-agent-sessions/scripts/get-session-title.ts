import type { Session } from "./types.ts"

/** Derive a compact one-line title from the first user message. */
export function getSessionTitle(
  /** Normalized session. */
  session: Session,
) {
  const message = session.messages.find(item => item.role === "user")
  if (!message) return "(no user message)"

  const title = message.text.replace(/\s+/g, " ").trim()
  return title.length > 100 ? `${title.slice(0, 97)}...` : title
}
