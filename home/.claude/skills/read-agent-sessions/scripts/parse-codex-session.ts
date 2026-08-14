import { basename } from "node:path"
import { isInjectedContext } from "./is-injected-context.ts"
import { parseJsonLines } from "./parse-json-lines.ts"
import type { Session, SessionMessage } from "./types.ts"

/** Normalize a Codex rollout JSONL transcript. */
export function parseCodexSession(
  /** Absolute source JSONL path. */
  path: string,
  /** JSONL content. */
  text: string,
  /** Whether to retain tool calls and results. */
  includeTools: boolean,
  /** Source file modification time. */
  fileModifiedAt: Date,
): Session {
  let id = basename(path, ".jsonl").replace(/^rollout-[^-]+-[^-]+-/, "")
  let cwd: string | undefined
  let createdAt: string | undefined
  const messages: SessionMessage[] = []

  for (const record of parseJsonLines(text)) {
    const timestamp = record.timestamp
    const payload = record.payload
    if (!payload || typeof payload !== "object") continue
    const item = payload as Record<string, unknown>

    if (record.type === "session_meta") {
      if (typeof item.id === "string") id = item.id
      if (typeof item.cwd === "string") cwd = item.cwd
      if (typeof item.timestamp === "string") createdAt = item.timestamp
      if (!createdAt && typeof timestamp === "string") createdAt = timestamp
      continue
    }

    if (record.type !== "response_item") continue

    if (
      item.type === "message" &&
      (item.role === "user" || item.role === "assistant") &&
      Array.isArray(item.content)
    ) {
      const texts = item.content
        .filter(
          (block): block is Record<string, unknown> => Boolean(block) && typeof block === "object",
        )
        .map(block => block.text)
        .filter((value): value is string => typeof value === "string")
        .filter(value => item.role !== "user" || !isInjectedContext(value))

      if (texts.length > 0) {
        messages.push({
          role: item.role,
          text: texts.join("\n\n"),
          timestamp: typeof timestamp === "string" ? timestamp : undefined,
        })
      }
      continue
    }

    if (!includeTools) continue

    if (
      (item.type === "function_call" ||
        item.type === "custom_tool_call" ||
        item.type === "local_shell_call") &&
      typeof item.name === "string"
    ) {
      const input = item.arguments ?? item.input ?? item.action
      messages.push({
        role: "tool",
        text: `${item.name}\n${typeof input === "string" ? input : JSON.stringify(input, null, 2)}`,
        timestamp: typeof timestamp === "string" ? timestamp : undefined,
      })
      continue
    }

    if (
      item.type === "function_call_output" ||
      item.type === "custom_tool_call_output" ||
      item.type === "local_shell_call_output"
    ) {
      const output = item.output ?? item.content
      messages.push({
        role: "tool",
        text: typeof output === "string" ? output : JSON.stringify(output, null, 2),
        timestamp: typeof timestamp === "string" ? timestamp : undefined,
      })
    }
  }

  return {
    provider: "codex",
    id,
    path,
    cwd,
    createdAt,
    fileModifiedAt,
    messages,
  }
}
