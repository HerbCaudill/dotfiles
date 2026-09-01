#!/usr/bin/env -S node --experimental-strip-types

import { spawn } from "node:child_process"
import { createWriteStream, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import readline from "node:readline"

import { isMainModule } from "../isMainModule.ts"

const MORNING_BRIEFING_GOAL =
  "Complete today's morning briefing without stopping until every source has either been gathered or diagnosed, the finished briefing has been saved to today's Obsidian daily note under `## Daily briefing`, and the saved section has been verified."

const MORNING_BRIEFING_RESEARCH_PROMPT =
  "Run my morning briefing using the morning-briefing skill. Follow its current instructions and the active goal. Research, diagnose source failures, write the briefing, save it in today's Obsidian daily note under `## Daily briefing`, and verify the saved section. Keep research and diagnostic activity out of the briefing itself. Read, summarize, diagnose, and save only; do not reply, change tasks, or schedule anything. Mark the active goal complete only after the saved briefing satisfies the skill."

const MORNING_BRIEFING_PRESENTATION_PROMPT =
  "Read today's Europe/Madrid Obsidian daily note at `~/Code/herbcaudill/notes/daily/YYYY-MM-DD.md`. Return only the `## Daily briefing` section exactly as saved, including that heading. Do not research, summarize, edit files, or add commentary."

const BRIEFINGS_DIRECTORY = join(homedir(), "Code/HerbCaudill/briefings")
const CODEX_COMMAND = join(homedir(), "Library/pnpm/bin/codex")
const DIAGNOSTIC_DIRECTORY = join(homedir(), ".local/state/morning-briefing")
const OBSIDIAN_SYNC_STATUS_CHECKS = 30
const OBSIDIAN_SYNC_STATUS_DELAY_MS = 1_000

/** Build the environment that classifies persisted threads for Codex Desktop. */
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

/** Build the request that creates the persisted diagnostic research thread. */
export function getMorningBriefingResearchThreadStartRequest() {
  return {
    method: "thread/start",
    id: 1,
    params: {
      model: "gpt-5.6-sol",
      cwd: BRIEFINGS_DIRECTORY,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      ephemeral: false,
      threadSource: "morning-briefing-research",
    },
  } as const
}

/** Build the dated user-facing name for the diagnostic research thread. */
export function getMorningBriefingResearchThreadName(now = new Date()): string {
  return `Morning briefing diagnostics – ${formatMorningBriefingDate(now)}`
}

/** Build the App Server equivalent of starting `/goal` for the research thread. */
export function getMorningBriefingGoalSetRequest(threadId: string) {
  return {
    method: "thread/goal/set",
    id: 3,
    params: {
      threadId,
      objective: MORNING_BRIEFING_GOAL,
      status: "active",
    },
  } as const
}

/** Build the request that starts research and writing under the active goal. */
export function getMorningBriefingResearchTurnStartRequest(threadId: string) {
  return {
    method: "turn/start",
    id: 4,
    params: {
      threadId,
      input: [{ type: "text", text: MORNING_BRIEFING_RESEARCH_PROMPT }],
      cwd: BRIEFINGS_DIRECTORY,
      model: "gpt-5.6-sol",
      effort: "medium",
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
    },
  } as const
}

/** Build the request that archives successful diagnostics while retaining them for debugging. */
export function getMorningBriefingArchiveRequest(threadId: string) {
  return {
    method: "thread/archive",
    id: 5,
    params: { threadId },
  } as const
}

/** Build the request that creates the clean user-facing briefing thread. */
export function getMorningBriefingPresentationThreadStartRequest() {
  return {
    method: "thread/start",
    id: 6,
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

/** Build the dated user-facing name for the finished briefing thread. */
export function getMorningBriefingPresentationThreadName(now = new Date()): string {
  return `Morning briefing – ${formatMorningBriefingDate(now)}`
}

/** Build the request that reads and presents the already-saved briefing without researching. */
export function getMorningBriefingPresentationTurnStartRequest(threadId: string) {
  return {
    method: "turn/start",
    id: 8,
    params: {
      threadId,
      input: [{ type: "text", text: MORNING_BRIEFING_PRESENTATION_PROMPT }],
      cwd: BRIEFINGS_DIRECTORY,
      model: "gpt-5.6-sol",
      effort: "low",
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
    },
  } as const
}

/** Decide whether successful research can be archived without interrupting an active turn. */
export function isMorningBriefingResearchReadyToArchive({
  phase,
  researchGoalComplete,
  researchTurnCompleted,
}: ResearchCompletionState): boolean {
  return phase === "research" && researchGoalComplete && researchTurnCompleted
}

/** Resume Obsidian Sync and wait until the notes vault reports that it is synced. */
export async function syncMorningBriefingToObsidian({
  maxStatusChecks = OBSIDIAN_SYNC_STATUS_CHECKS,
  openObsidian = openObsidianApp,
  runObsidian = runObsidianCommand,
  wait = waitForObsidianSyncStatus,
}: ObsidianSyncDependencies = {}): Promise<void> {
  await openObsidian()

  for (let attempt = 0; attempt < maxStatusChecks; attempt += 1) {
    try {
      await runObsidian(["vault=notes", "sync", "on"])
      break
    } catch (error) {
      if (attempt === maxStatusChecks - 1) throw error
      await wait()
    }
  }

  for (let check = 0; check < maxStatusChecks; check += 1) {
    const status = await runObsidian(["vault=notes", "sync:status"])
    if (status.split("\n").some(line => line.trim() === "status: synced")) return
    if (check < maxStatusChecks - 1) await wait()
  }

  throw new Error(`Obsidian Sync did not finish after ${maxStatusChecks} status checks`)
}

/** Open Obsidian so its CLI and Sync service are available. */
function openObsidianApp(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("open", ["-a", "Obsidian"], { stdio: "ignore" })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          signal
            ? `Opening Obsidian stopped by ${signal}`
            : `Opening Obsidian exited with status ${code ?? "unknown"}`,
        ),
      )
    })
  })
}

/** Run research under a goal, archive its diagnostics, then create a clean briefing thread. */
export async function runMorningBriefing(): Promise<void> {
  mkdirSync(DIAGNOSTIC_DIRECTORY, { recursive: true })
  const diagnosticLog = createWriteStream(getMorningBriefingDiagnosticLogPath(), { flags: "a" })
  const child = spawn(CODEX_COMMAND, ["app-server"], {
    env: getMorningBriefingAppServerEnvironment(),
    stdio: ["pipe", "pipe", "inherit"],
  })
  const lines = readline.createInterface({ input: child.stdout })

  await new Promise<void>((resolve, reject) => {
    let finalMessage = ""
    let phase: Phase = "initializing"
    let researchGoalComplete = false
    let researchThreadId = ""
    let presentationThreadId = ""
    let researchSyncStarted = false
    let researchTurnCompleted = false
    let settled = false
    let shutdownTimer: NodeJS.Timeout | undefined

    const stopWithError = (error: Error) => {
      if (settled) return
      settled = true
      diagnosticLog.end()
      child.kill("SIGTERM")
      reject(error)
    }

    const send = (request: unknown) => {
      child.stdin.write(`${JSON.stringify(request)}\n`)
    }

    const syncAndArchiveSuccessfulResearch = () => {
      if (
        !isMorningBriefingResearchReadyToArchive({
          phase,
          researchGoalComplete,
          researchTurnCompleted,
        }) ||
        researchSyncStarted
      ) {
        return
      }

      researchSyncStarted = true
      void syncMorningBriefingToObsidian()
        .then(() => {
          if (settled) return
          phase = "archiving"
          send(getMorningBriefingArchiveRequest(researchThreadId))
        })
        .catch(error => {
          stopWithError(error instanceof Error ? error : new Error(String(error)))
        })
    }

    child.on("error", stopWithError)
    child.on("exit", (code, signal) => {
      if (shutdownTimer) clearTimeout(shutdownTimer)
      diagnosticLog.end()
      if (settled) return
      settled = true

      if (phase === "complete") {
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
      diagnosticLog.write(`${line}\n`)

      try {
        const message = JSON.parse(line) as AppServerMessage

        if (message.id !== undefined && message.error) {
          stopWithError(new Error(message.error.message))
          return
        }

        if (message.id === 0) {
          send({ method: "initialized", params: {} })
          send(getMorningBriefingResearchThreadStartRequest())
          return
        }

        if (message.id === 1) {
          researchThreadId = message.result?.thread?.id ?? ""
          if (!researchThreadId) {
            stopWithError(new Error("Codex App Server did not return a research thread id"))
            return
          }

          send({
            method: "thread/name/set",
            id: 2,
            params: {
              threadId: researchThreadId,
              name: getMorningBriefingResearchThreadName(),
            },
          })
          return
        }

        if (message.id === 2) {
          send(getMorningBriefingGoalSetRequest(researchThreadId))
          return
        }

        if (message.id === 3) {
          phase = "research"
          send(getMorningBriefingResearchTurnStartRequest(researchThreadId))
          return
        }

        if (message.method === "thread/goal/updated" && message.params?.goal) {
          const goalStatus = message.params.goal.status
          researchGoalComplete = goalStatus === "complete"

          if (["paused", "blocked", "usageLimited", "budgetLimited"].includes(goalStatus ?? "")) {
            stopWithError(new Error(`Morning briefing goal stopped with status ${goalStatus}`))
            return
          }

          syncAndArchiveSuccessfulResearch()
          return
        }

        if (message.method === "thread/goal/cleared" && phase === "research") {
          stopWithError(new Error("Morning briefing goal was cleared before completion"))
          return
        }

        if (message.method === "turn/started" && phase === "research") {
          researchTurnCompleted = false
          return
        }

        const item = message.params?.item
        if (message.method === "item/completed" && item?.type === "agentMessage") {
          if (phase === "presentation") finalMessage = item.text ?? finalMessage
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

          if (phase === "research") {
            researchTurnCompleted = true
            syncAndArchiveSuccessfulResearch()
            return
          }

          if (phase === "presentation") {
            if (!finalMessage) {
              stopWithError(new Error("Morning briefing presentation returned no final message"))
              return
            }

            process.stdout.write(`${finalMessage}\n`)
            phase = "complete"
            settled = true
            diagnosticLog.end()
            shutdownTimer = setTimeout(() => child.kill("SIGTERM"), 5_000)
            child.stdin.end()
            resolve()
          }
          return
        }

        if (message.id === 5) {
          phase = "starting-presentation"
          send(getMorningBriefingPresentationThreadStartRequest())
          return
        }

        if (message.id === 6) {
          presentationThreadId = message.result?.thread?.id ?? ""
          if (!presentationThreadId) {
            stopWithError(new Error("Codex App Server did not return a presentation thread id"))
            return
          }

          send({
            method: "thread/name/set",
            id: 7,
            params: {
              threadId: presentationThreadId,
              name: getMorningBriefingPresentationThreadName(),
            },
          })
          return
        }

        if (message.id === 7) {
          phase = "presentation"
          send(getMorningBriefingPresentationTurnStartRequest(presentationThreadId))
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

/** Format the date used in thread names. */
function formatMorningBriefingDate(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "Europe/Madrid",
  }).format(now)
}

/** Get the dated JSONL path for raw App Server diagnostics. */
function getMorningBriefingDiagnosticLogPath(now = new Date()): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(now)

  return join(DIAGNOSTIC_DIRECTORY, `${date}.jsonl`)
}

/** Run one official Obsidian CLI command and return its standard output. */
function runObsidianCommand(arguments_: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("obsidian", arguments_, { stdio: ["ignore", "pipe", "pipe"] })
    let standardError = ""
    let standardOutput = ""

    child.stdout.on("data", chunk => {
      standardOutput += String(chunk)
    })
    child.stderr.on("data", chunk => {
      standardError += String(chunk)
    })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(standardOutput)
        return
      }

      reject(
        new Error(
          standardError.trim() ||
            (signal
              ? `Obsidian CLI stopped by ${signal}`
              : `Obsidian CLI exited with status ${code ?? "unknown"}`),
        ),
      )
    })
  })
}

/** Wait before checking Obsidian Sync status again. */
function waitForObsidianSyncStatus(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, OBSIDIAN_SYNC_STATUS_DELAY_MS))
}

type Phase =
  | "initializing"
  | "research"
  | "archiving"
  | "starting-presentation"
  | "presentation"
  | "complete"

type ResearchCompletionState = {
  phase: Phase
  researchGoalComplete: boolean
  researchTurnCompleted: boolean
}

type ObsidianSyncDependencies = {
  /** Maximum number of Sync status checks before failing the briefing run. */
  maxStatusChecks?: number
  /** Open Obsidian so its CLI and Sync service become available. */
  openObsidian?: () => Promise<void>
  /** Run one Obsidian CLI command and return its standard output. */
  runObsidian?: (arguments_: string[]) => Promise<string>
  /** Wait before the next Sync status check. */
  wait?: () => Promise<void>
}

type AppServerMessage = {
  id?: number
  method?: string
  error?: { message: string }
  result?: {
    thread?: { id: string }
  }
  params?: {
    goal?: { status?: string }
    item?: { type?: string; text?: string }
    turn?: {
      status?: string
      error?: { message?: string } | null
    }
  }
}
