import type { Session } from "./types.ts"

/** Render a normalized transcript as Markdown. */
export function renderTranscript(
  /** Normalized session. */
  session: Session,
) {
  const metadata = [
    `# ${session.provider} session ${session.id}`,
    "",
    `- Updated: ${session.updatedAt.toISOString()}`,
    `- Working directory: ${session.cwd ?? "unknown"}`,
    `- Source: ${session.path}`,
  ]
  const conversation = session.messages.flatMap(message => [
    "",
    `## ${message.role[0].toUpperCase()}${message.role.slice(1)}`,
    "",
    message.text,
  ])

  return [...metadata, ...conversation].join("\n")
}
