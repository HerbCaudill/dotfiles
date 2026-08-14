import type { Session } from "./types.ts"

/** Serialize one or more normalized sessions for programmatic consumers. */
export function renderJson(
  /** Session or session list to serialize. */
  value: Session | Session[],
) {
  return JSON.stringify(
    Array.isArray(value) ? value.map(serializeSession) : serializeSession(value),
    null,
    2,
  )
}

/** Convert Date metadata to an explicit ISO string. */
function serializeSession(session: Session) {
  return {
    ...session,
    fileModifiedAt: session.fileModifiedAt.toISOString(),
  }
}
