import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"

import { classifyWithJev } from "./classifyWithJev.ts"
import { createGmailClient, type GmailRequest } from "./createGmailClient.ts"
import {
  appendEmailDecision,
  loadEmailDecisionLog,
  loadEmailProcessingState,
  saveEmailProcessingState,
} from "./emailProcessingStorage.ts"
import {
  approveBatch,
  declineBatch,
  proposeBatches,
  queueUnsubscribe,
  type ProposalDependencies,
  type ProposalPaths,
} from "./emailProposals.ts"
import { createEmailTasksClient, type EmailTasksClient } from "./emailTasks.ts"
import { runGmailSupervisor } from "./runGmailSupervisor.ts"
import { summarizeDecisions } from "./summarizeDecisions.ts"
import type { GmailSupervisorDependencies, GmailSupervisorResult } from "./supervisorTypes.ts"

/** Run, review or act on approvals for the email-processing job. */
export async function runEmailProcessingCommand(
  /** Runtime boundaries and paths, injectable for end-to-end tests. */
  options: EmailProcessingCommandOptions = {},
): Promise<GmailSupervisorResult | null> {
  const [command = "run", ...rest] = options.args ?? process.argv.slice(2)
  const writeLine = options.writeLine ?? console.log
  const writeError = options.writeError ?? console.error
  const now = options.now ?? (() => new Date())
  const gmail = () => createGmailClient({ request: options.gmailRequest })
  const loadDecisionLog = () => loadEmailDecisionLog(options.decisionLogPath)
  const proposalDependencies = (): ProposalDependencies => ({
    now,
    gmail: gmail(),
    tasks: options.tasks ?? createEmailTasksClient(),
    fetch: options.fetch ?? globalThis.fetch,
    loadDecisionLog,
    paths: options.proposalPaths,
  })

  switch (command) {
    case "help":
    case "--help":
      HELP_LINES.forEach(line => writeLine(line))
      return null

    case "review":
      requireNoArguments(command, rest)
      ;(await loadDecisionLog()).forEach(decision => writeLine(JSON.stringify(decision)))
      return null

    case "summary": {
      const { values } = parseArgs({
        args: rest,
        options: { hours: { type: "string", default: "24" } },
      })
      const hours = Number(values.hours)
      if (!(hours > 0)) throw new Error("--hours must be a positive number")
      writeLine(
        await summarizeDecisions({
          decisions: await loadDecisionLog(),
          since: new Date(now().getTime() - hours * 3_600_000),
          gmail: gmail(),
        }),
      )
      return null
    }

    case "cutover": {
      requireNoArguments(command, rest)
      const [state, profile] = await Promise.all([
        loadEmailProcessingState(options.statePath),
        gmail().getProfile(),
      ])
      await saveEmailProcessingState(
        {
          lastHistoryId: profile.historyId,
          lastCompletedAt: now().toISOString(),
          retryMessageIds: [],
          archiveReversalSenders: state.archiveReversalSenders,
        },
        options.statePath,
      )
      writeLine("cutover=ok")
      return null
    }

    case "propose":
      requireNoArguments(command, rest)
      ;(await proposeBatches(proposalDependencies())).forEach(line => writeLine(line))
      return null

    case "approve": {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { except: { type: "string", default: "" } },
      })
      if (positionals.length !== 1)
        throw new Error("Usage: email-processing approve <batch> [--except a,b]")
      const lines = await approveBatch(
        proposalDependencies(),
        positionals[0]!,
        values.except.split(","),
      )
      lines.forEach(line => writeLine(line))
      return null
    }

    case "decline": {
      if (rest.length !== 1) throw new Error("Usage: email-processing decline <batch>")
      ;(await declineBatch(proposalDependencies(), rest[0]!)).forEach(line => writeLine(line))
      return null
    }

    case "run":
    case "--log-only": {
      const { values } = parseArgs({
        args: command === "run" ? rest : [command, ...rest],
        options: { "log-only": { type: "boolean", default: false } },
      })
      const logOnly = values["log-only"]
      const classify: GmailSupervisorDependencies["classify"] =
        options.classify ??
        (await (async () => {
          const apiKey = await loadJevApiKey()
          return input => classifyWithJev(input, { apiKey })
        })())
      const result = await runGmailSupervisor({
        now,
        gmail: gmail(),
        classify: async input => {
          try {
            return await classify(input)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            writeError(
              `[email-processing] Jev failed: ${message.replaceAll(/\s+/g, " ").slice(0, 500)}`,
            )
            throw error
          }
        },
        logOnly,
        queueUnsubscribe: candidate => queueUnsubscribe(candidate, options.proposalPaths?.store),
        loadState: () => loadEmailProcessingState(options.statePath),
        saveState: state => saveEmailProcessingState(state, options.statePath),
        loadDecisionLog,
        appendDecision: decision => appendEmailDecision(decision, options.decisionLogPath),
      })
      writeLine(formatEmailProcessingResult(result, logOnly))
      return result
    }

    default:
      throw new Error(`Unknown command: ${command}. Run email-processing help.`)
  }
}

/** Format only compact, non-sensitive run counts for routine output. */
export function formatEmailProcessingResult(
  /** Completed supervisor counts. */
  result: GmailSupervisorResult,
  /** Whether Gmail was left unchanged. */
  logOnly = false,
): string {
  return `${logOnly ? "mode=log-only " : ""}archived=${result.archived} promoted=${result.promoted} unchanged=${result.unchanged} retried=${result.retried} pending=${result.pending} corrected=${result.corrected}`
}

/**
 * Read the TypeSafe key from JEV_API_KEY, or from the `export JEV_API_KEY=…` line in ~/.secrets,
 * since scheduled tasks don't load a shell profile.
 */
export async function loadJevApiKey(
  /** Secrets file, injectable for tests. */
  secretsPath = join(homedir(), ".secrets"),
): Promise<string> {
  if (process.env.JEV_API_KEY) return process.env.JEV_API_KEY
  try {
    const match = (await readFile(secretsPath, "utf8")).match(
      /^\s*export\s+JEV_API_KEY=["']?([^"'\s]+)["']?\s*$/m,
    )
    if (match) return match[1]!
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  throw new Error("JEV_API_KEY is not set and is not in ~/.secrets")
}

/** Reject arguments for commands that take none. */
function requireNoArguments(
  /** Command name. */
  command: string,
  /** Remaining arguments. */
  rest: readonly string[],
): void {
  if (rest.length > 0) throw new Error(`${command} takes no arguments`)
}

/** Runtime boundaries accepted by the command entry point. */
export type EmailProcessingCommandOptions = {
  /** Command arguments after the executable name. */
  args?: readonly string[]
  /** Stable wall clock for deterministic tests. */
  now?: () => Date
  /** Gmail API call boundary. */
  gmailRequest?: GmailRequest
  /** Jev boundary. */
  classify?: GmailSupervisorDependencies["classify"]
  /** Tasks board boundary. */
  tasks?: EmailTasksClient
  /** Fetch for one-click unsubscribe requests. */
  fetch?: ProposalDependencies["fetch"]
  /** Optional durable state path override. */
  statePath?: string
  /** Optional append-only decision-log path override. */
  decisionLogPath?: string
  /** Optional proposal file path overrides. */
  proposalPaths?: Partial<ProposalPaths>
  /** Compact line-oriented output boundary. */
  writeLine?: (line: string) => void
  /** Sanitized operational diagnostic boundary. */
  writeError?: (line: string) => void
}

const HELP_LINES = [
  "Usage: email-processing [command]",
  "",
  "  run [--log-only]   Process new Gmail with Jev and the email rules (the default command).",
  "                     --log-only records what it would do without changing Gmail.",
  "  summary [--hours N] Summarize decisions from the last N hours (default 24), with where each thread is now.",
  "  review             Print the decision log. Raw error exceptions can contain sensitive diagnostics.",
  "  cutover            Discard retries and start after Gmail's current history position.",
  "  propose            Turn queued unsubscribes and repeat-archive senders into batches for Herb's Tasks Inbox.",
  "  approve <batch> [--except a@x.com,b@y.com]",
  "                     Unsubscribe or create filters for the approved senders and complete the task.",
  "  decline <batch>    Decline every sender in a batch and complete the task.",
  "",
  "State: ~/.local/share/email-processing/state.json",
  "Decisions: ~/.local/share/email-processing/decisions.jsonl",
  "Proposals: ~/.local/share/email-processing/proposals.json",
  "After a failure, rerun the same command; saved retries and verified changes make reruns safe.",
]
