import { basename } from "node:path"
import { parseJsonLines } from "./parse-json-lines.ts"
import type { Session, SessionMessage } from "./types.ts"

/** Normalize a Claude Code project JSONL transcript. */
export function parseClaudeSession(
  /** Absolute source JSONL path. */
  path: string,
  /** JSONL content. */
  text: string,
  /** Whether to retain tool calls and results. */
  includeTools: boolean,
  /** Source file modification time. */
  fileModifiedAt: Date,
): Session {
  let id = basename(path, ".jsonl")
  let cwd: string | undefined
  let createdAt: string | undefined
  const messages: SessionMessage[] = []

  for (const record of parseJsonLines(text)) {
    const sessionId = record.sessionId
    const recordCwd = record.cwd
    const timestamp = record.timestamp

    if (typeof sessionId === "string") id = sessionId
    if (!cwd && typeof recordCwd === "string") cwd = recordCwd
    if (!createdAt && typeof timestamp === "string") createdAt = timestamp
    if (record.isSidechain === true) continue

    const message = record.message
    if (!message || typeof message !== "object") continue

    const content = (message as Record<string, unknown>).content
    if (record.type === "user" && typeof content === "string") {
      if (content.trim()) {
        messages.push({
          role: "user",
          text: content,
          timestamp: typeof timestamp === "string" ? timestamp : undefined,
        })
      }
      continue
    }

    if (!Array.isArray(content)) continue

    if (record.type === "assistant") {
      for (const block of content) {
        if (!block || typeof block !== "object") continue
        const item = block as Record<string, unknown>

        if (item.type === "text" && typeof item.text === "string") {
          messages.push({
            role: "assistant",
            text: item.text,
            timestamp: typeof timestamp === "string" ? timestamp : undefined,
          })
        }

        if (includeTools && item.type === "tool_use" && typeof item.name === "string") {
          messages.push({
            role: "tool",
            text: `${item.name}\n${JSON.stringify(item.input, null, 2)}`,
            timestamp: typeof timestamp === "string" ? timestamp : undefined,
          })
        }
      }
    }

    if (includeTools && record.type === "user") {
      for (const block of content) {
        if (!block || typeof block !== "object") continue
        const item = block as Record<string, unknown>
        if (item.type !== "tool_result") continue

        messages.push({
          role: "tool",
          text:
            typeof item.content === "string" ? item.content : JSON.stringify(item.content, null, 2),
          timestamp: typeof timestamp === "string" ? timestamp : undefined,
        })
      }
    }
  }

  return {
    provider: "claude",
    id,
    path,
    cwd,
    createdAt,
    fileModifiedAt,
    messages,
  }
}
