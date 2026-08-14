import { renderMessages } from "./render-messages.ts"
import type { Session } from "./types.ts"

/** Render a normalized transcript as Markdown. */
export function renderTranscript(
  /** Normalized session. */
  session: Session,
  /** Whether to include local event timestamps in turn headings. */
  includeTimestamps = false,
) {
  const metadata = [
    `# ${session.provider} session ${session.id}`,
    "",
    `- File modified: ${session.fileModifiedAt.toISOString()}`,
    `- Working directory: ${session.cwd ?? "unknown"}`,
    `- Source: ${session.path}`,
  ]
  if (session.untimestampedMessagesOmitted) {
    metadata.push(`- Untimestamped messages omitted: ${session.untimestampedMessagesOmitted}`)
  }
  const conversation = renderMessages(session.messages, 2, includeTimestamps)

  return [...metadata, ...conversation].join("\n")
}
