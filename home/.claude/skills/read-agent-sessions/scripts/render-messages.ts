import { formatLocalDateTime } from "./parse-time-window.ts"
import type { SessionMessage } from "./types.ts"

/** Render normalized conversation messages as Markdown sections. */
export function renderMessages(
  /** Messages to render. */
  messages: SessionMessage[],
  /** Markdown heading level for each speaker turn. */
  headingLevel: 2 | 3,
  /** Whether to append local timestamps to headings. */
  includeTimestamps: boolean,
) {
  const heading = "#".repeat(headingLevel)
  return mergeAdjacentMessages(messages).flatMap(message => {
    const role = `${message.role[0].toUpperCase()}${message.role.slice(1)}`
    const timestamp =
      includeTimestamps && message.timestamp
        ? ` — ${formatLocalDateTime(new Date(message.timestamp))}`
        : ""

    return ["", `${heading} ${role}${timestamp}`, "", message.text]
  })
}

/** Merge text blocks belonging to the same contiguous harness turn. */
function mergeAdjacentMessages(messages: SessionMessage[]) {
  return messages.reduce<SessionMessage[]>((merged, message) => {
    const previous = merged.at(-1)
    if (previous?.role !== message.role || previous.timestamp !== message.timestamp) {
      return [...merged, message]
    }

    return [
      ...merged.slice(0, -1),
      {
        ...previous,
        text: `${previous.text}\n\n${message.text}`,
      },
    ]
  }, [])
}
