import { isInjectedContext } from "../../home/.claude/skills/read-agent-sessions/scripts/is-injected-context.ts"

/** Select native harness fields needed to recover conversation and tool text. */
export function toReadableTranscriptRecord(
  /** Parsed source record. */
  record: Record<string, unknown>,
  /** Harness when this is a recognized conversation transcript. */
  provider: "claude" | "codex" | undefined,
): Record<string, unknown> | undefined {
  if (provider === "codex") {
    const item = record.payload as Record<string, unknown> | undefined
    if (!item) return undefined
    if (record.type === "session_meta")
      return {
        type: record.type,
        timestamp: record.timestamp,
        payload: { id: item.id, cwd: item.cwd, timestamp: item.timestamp },
      }
    if (record.type !== "response_item") return undefined
    if (item.type === "message") {
      if (item.role !== "user" && item.role !== "assistant") return undefined
      const content = Array.isArray(item.content)
        ? item.content.filter(
            block =>
              item.role !== "user" ||
              typeof block?.text !== "string" ||
              !isInjectedContext(block.text),
          )
        : item.content
      return {
        type: record.type,
        timestamp: record.timestamp,
        payload: { type: item.type, role: item.role, content },
      }
    }
    if (
      ![
        "function_call",
        "custom_tool_call",
        "local_shell_call",
        "function_call_output",
        "custom_tool_call_output",
        "local_shell_call_output",
      ].includes(String(item.type))
    )
      return undefined
    return { type: record.type, timestamp: record.timestamp, payload: item }
  }
  if (provider === "claude") {
    if (record.type !== "user" && record.type !== "assistant") return undefined
    const message = record.message as Record<string, unknown> | undefined
    if (!message) return undefined
    if (
      record.type === "user" &&
      typeof message.content === "string" &&
      isInjectedContext(message.content)
    )
      return undefined
    const content = Array.isArray(message.content)
      ? message.content.filter(block => !["thinking", "redacted_thinking"].includes(block?.type))
      : message.content
    return {
      type: record.type,
      sessionId: record.sessionId,
      cwd: record.cwd,
      timestamp: record.timestamp,
      isSidechain: record.isSidechain,
      message: { role: message.role, content },
    }
  }
  return record
}
