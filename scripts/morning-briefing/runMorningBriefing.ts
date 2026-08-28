#!/usr/bin/env -S node --experimental-strip-types

import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import readline from "node:readline"

import { isMainModule } from "../isMainModule.ts"

const MORNING_BRIEFING_PROMPT =
  "Run my morning briefing using the morning-briefing skill. Follow its current instructions, save the completed briefing in today's Obsidian daily note under `## Daily briefing`, and print the same briefing as your final response. Read, summarize, and save the briefing only; do not reply, change tasks, or schedule anything."

const BRIEFINGS_DIRECTORY = join(homedir(), "Code/HerbCaudill/briefings")
const CODEX_COMMAND = join(homedir(), "Library/pnpm/bin/codex")

/** Build the environment that classifies the persisted thread for Codex Desktop. */
export function getMorningBriefingAppServerEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...environment,
    CODEX_INTERNAL_ORIGINATOR_OVERRIDE: "Codex Desktop",
  }
}

/** Build the App Server initialization request using Codex's interactive CLI identity. */
export function getMorningBriefingInitializeRequest() {
  return {
    method: "initialize",
    id: 0,
    params: {
      clientInfo: {
        name: "codex_cli_rs",
        title: "Morning Briefing Scheduler",
        version: "1.0.0",
      },
      capabilities: null,
    },
  } as const
}

/** Build the request that creates one persisted morning briefing thread. */
export function getMorningBriefingThreadStartRequest() {
  return {
    method: "thread/start",
    id: 1,
    params: {
      model: "gpt-5.6-sol",
      cwd: BRIEFINGS_DIRECTORY,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      ephemeral: false,
      threadSource: "morning-briefing",
    },
  } as const
}

/** Build the dated user-facing name for a morning briefing thread. */
export function getMorningBriefingThreadName(now = new Date()): string {
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "Europe/Madrid",
  }).format(now)

  return `Morning briefing – ${date}`
}

/** Build the request that starts the briefing turn in a persisted thread. */
export function getMorningBriefingTurnStartRequest(threadId: string) {
  return {
    method: "turn/start",
    id: 3,
    params: {
      threadId,
      input: [{ type: "text", text: MORNING_BRIEFING_PROMPT }],
      cwd: BRIEFINGS_DIRECTORY,
      model: "gpt-5.6-sol",
      effort: "medium",
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
    },
  } as const
}

/** Run one morning briefing in a named Codex thread visible in the desktop sidebar. */
export async function runMorningBriefing(): Promise<void> {
  const child = spawn(CODEX_COMMAND, ["app-server"], {
    env: getMorningBriefingAppServerEnvironment(),
    stdio: ["pipe", "pipe", "inherit"],
  })
  const lines = readline.createInterface({ input: child.stdout })

  await new Promise<void>((resolve, reject) => {
    let finalMessage = ""
    let settled = false
    let shutdownTimer: NodeJS.Timeout | undefined
    let threadId = ""
    let turnCompleted = false

    const stopWithError = (error: Error) => {
      if (settled) return
      settled = true
      child.kill("SIGTERM")
      reject(error)
    }

    const send = (request: unknown) => {
      child.stdin.write(`${JSON.stringify(request)}\n`)
    }

    child.on("error", stopWithError)
    child.on("exit", (code, signal) => {
      if (shutdownTimer) clearTimeout(shutdownTimer)
      if (settled) return
      settled = true

      if (turnCompleted) {
        resolve()
        return
      }

      reject(
        new Error(
          signal
            ? `Codex App Server stopped by ${signal}`
            : `Codex App Server exited with status ${code ?? "unknown"}`,
        ),
      )
    })

    lines.on("line", line => {
      try {
        const message = JSON.parse(line) as AppServerMessage

        if (message.id !== undefined && message.error) {
          stopWithError(new Error(message.error.message))
          return
        }

        if (message.id === 0) {
          send({ method: "initialized", params: {} })
          send(getMorningBriefingThreadStartRequest())
          return
        }

        if (message.id === 1) {
          threadId = message.result?.thread?.id ?? ""
          if (!threadId) {
            stopWithError(new Error("Codex App Server did not return a thread id"))
            return
          }

          send({
            method: "thread/name/set",
            id: 2,
            params: { threadId, name: getMorningBriefingThreadName() },
          })
          return
        }

        if (message.id === 2) {
          if (!threadId) {
            stopWithError(new Error("Codex App Server did not confirm the named thread"))
            return
          }

          send(getMorningBriefingTurnStartRequest(threadId))
          return
        }

        const item = message.params?.item
        if (message.method === "item/completed" && item?.type === "agentMessage") {
          finalMessage = item.text ?? finalMessage
          return
        }

        if (message.method === "turn/completed") {
          const turn = message.params?.turn
          if (turn?.status !== "completed") {
            stopWithError(
              new Error(turn?.error?.message ?? `Morning briefing ${turn?.status ?? "failed"}`),
            )
            return
          }

          if (finalMessage) process.stdout.write(`${finalMessage}\n`)
          turnCompleted = true
          shutdownTimer = setTimeout(() => child.kill("SIGTERM"), 5_000)
          child.stdin.end()
        }
      } catch (error) {
        stopWithError(error instanceof Error ? error : new Error(String(error)))
      }
    })

    send(getMorningBriefingInitializeRequest())
  })
}

if (isMainModule(import.meta.url)) {
  void runMorningBriefing().catch(error => {
    console.error(`[morning-briefing] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}

type AppServerMessage = {
  id?: number
  method?: string
  error?: { message: string }
  result?: {
    thread?: { id: string }
  }
  params?: {
    item?: { type?: string; text?: string }
    turn?: {
      status?: string
      error?: { message?: string } | null
    }
  }
}
