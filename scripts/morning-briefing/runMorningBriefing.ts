#!/usr/bin/env -S node --experimental-strip-types

import { spawnSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

import { isMainModule } from "../isMainModule.ts"

const MORNING_BRIEFING_PROMPT =
  "Run my morning briefing using the morning-briefing skill. Follow its current instructions, save the completed briefing in today's Obsidian daily note under `## Daily briefing`, and print the same briefing as your final response. Read, summarize, and save the briefing only; do not reply, change tasks, or schedule anything."

/** Build the Codex CLI arguments for one unattended morning briefing. */
export function getMorningBriefingCodexArgs(): string[] {
  return [
    "--ask-for-approval",
    "never",
    "exec",
    "--model",
    "gpt-5.6-sol",
    "--config",
    'model_reasoning_effort="medium"',
    "--sandbox",
    "danger-full-access",
    "--cd",
    join(homedir(), "Code/HerbCaudill/briefings"),
    MORNING_BRIEFING_PROMPT,
  ]
}

/** Run one morning briefing through Codex and stream its output to the caller. */
export function runMorningBriefing(): void {
  const result = spawnSync("codex", getMorningBriefingCodexArgs(), {
    stdio: "inherit",
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      result.signal
        ? `codex exec stopped by ${result.signal}`
        : `codex exec exited with status ${result.status}`,
    )
  }
}

if (isMainModule(import.meta.url)) {
  try {
    runMorningBriefing()
  } catch (error) {
    console.error(`[morning-briefing] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
