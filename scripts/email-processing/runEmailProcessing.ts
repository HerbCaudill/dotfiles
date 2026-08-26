import { classifyWithCodex } from "./classifyWithCodex.ts"
import { createGwsGmailClient, type GwsCommandRunner } from "./createGwsGmailClient.ts"
import {
  appendEmailDecision,
  loadEmailDecisionLog,
  loadEmailProcessingState,
  saveEmailProcessingState,
} from "./emailProcessingStorage.ts"
import { runGmailSupervisor } from "./runGmailSupervisor.ts"
import type { GmailSupervisorDependencies, GmailSupervisorResult } from "./supervisorTypes.ts"

/** Run or review the headless email-processing workflow. */
export async function runEmailProcessingCommand(
  /** Runtime boundaries and paths, injectable for end-to-end tests. */
  options: EmailProcessingCommandOptions = {},
): Promise<GmailSupervisorResult | null> {
  const args = options.args ?? process.argv.slice(2)
  const writeLine = options.writeLine ?? console.log

  if (args.length === 1 && args[0] === "--help") {
    HELP_LINES.forEach(line => writeLine(line))
    return null
  }
  if (args.length === 1 && args[0] === "--review") {
    const decisions = await loadEmailDecisionLog(options.decisionLogPath)
    decisions.forEach(decision => writeLine(JSON.stringify(decision)))
    return null
  }
  if (args.length > 0) throw new Error(`Unknown argument: ${args.join(" ")}`)

  const result = await runGmailSupervisor({
    now: options.now ?? (() => new Date()),
    gmail: createGwsGmailClient({ run: options.runGws }),
    classify: options.classify ?? classifyWithCodex,
    loadState: () => loadEmailProcessingState(options.statePath),
    saveState: state => saveEmailProcessingState(state, options.statePath),
    loadDecisionLog: () => loadEmailDecisionLog(options.decisionLogPath),
    appendDecision: decision => appendEmailDecision(decision, options.decisionLogPath),
  })
  writeLine(formatEmailProcessingResult(result))
  return result
}

/** Format only compact, non-sensitive run counts for routine output. */
export function formatEmailProcessingResult(
  /** Completed supervisor counts. */
  result: GmailSupervisorResult,
): string {
  return `archived=${result.archived} promoted=${result.promoted} unchanged=${result.unchanged} retried=${result.retried} corrected=${result.corrected}`
}

/** Runtime boundaries accepted by the command entry point. */
export type EmailProcessingCommandOptions = {
  /** Command arguments after the executable name. */
  args?: readonly string[]
  /** Stable wall clock for deterministic tests. */
  now?: GmailSupervisorDependencies["now"]
  /** Fixed-argument gws process boundary. */
  runGws?: GwsCommandRunner
  /** Isolated classifier boundary. */
  classify?: GmailSupervisorDependencies["classify"]
  /** Optional durable state path override. */
  statePath?: string
  /** Optional append-only decision-log path override. */
  decisionLogPath?: string
  /** Compact line-oriented output boundary. */
  writeLine?: (line: string) => void
}

const HELP_LINES = [
  "Usage: email-processing [--review|--help]",
  "Run without arguments to process Gmail with the supervised classifier.",
  "Use --review to print the sanitized decision log.",
  "State: ~/.local/share/email-processing/state.json",
  "Decisions: ~/.local/share/email-processing/decisions.jsonl",
  "After a failure, rerun the same command; saved retries and verified mutations make reruns safe.",
]
