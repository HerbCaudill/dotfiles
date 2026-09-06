import { runTasksCommand } from "./runTasksCommand.ts"
import type { TasksCall, TasksResponse } from "./types.ts"

/** Bind every workflow call to reviewed runtime context and an explicit freshness requirement. */
export function createTasksCall(
  /** Activation supplies the enrolled space and required evidence; there is no fallback. */
  context: { spaceId: string; freshness: "local" | "edge-upload" | "converged" },
  /** Isolated process boundary for fixtures. */
  run = runTasksCommand,
): TasksCall {
  if (!context.spaceId.trim() || !["local", "edge-upload", "converged"].includes(context.freshness))
    throw new Error("Tasks space and explicit freshness are required")
  return async (command, input, requestId) => {
    if (!["status", "capture", "save-description", "inspect", "retry"].includes(command))
      throw new Error("Unsupported PR workflow command")
    const json = JSON.stringify(input) + "\n"
    if (Buffer.byteLength(json) > 1024 * 1024)
      throw new Error("Tasks PR input exceeds the request limit")
    const args = [
      command,
      "--timezone",
      "Europe/Madrid",
      "--freshness",
      context.freshness,
      "--timeout-ms",
      "70000",
      "--input",
      "-",
      ...(requestId ? ["--request-id", requestId] : []),
    ]
    const { code, stdout } = await run(args, json)
    const response = JSON.parse(stdout) as TasksResponse
    if (
      !response ||
      !Object.hasOwn(EXIT_CODES, response.status) ||
      code !== EXIT_CODES[response.status]
    )
      throw new Error("Tasks response and process exit disagree")
    if (response.status === "ok" || response.status === "saved" || response.receipt) {
      if (
        response.metadata?.spaceId !== context.spaceId ||
        response.metadata?.timezone !== "Europe/Madrid" ||
        typeof response.metadata?.observedAt !== "string" ||
        Number.isNaN(Date.parse(response.metadata.observedAt))
      )
        throw new Error("Tasks response does not match the reviewed space and observation context")
    }
    return response
  }
}

const EXIT_CODES = { ok: 0, saved: 0, invalid: 2, conflict: 3, unavailable: 4, unconfirmed: 5 }
