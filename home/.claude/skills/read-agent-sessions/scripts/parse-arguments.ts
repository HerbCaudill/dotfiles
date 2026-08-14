import type { CliOptions, Provider } from "./types.ts"
import { parseTimeWindow } from "./parse-time-window.ts"

/** Parse and validate the agent session CLI arguments. */
export function parseArguments(
  /** Raw arguments after the Node executable and script path. */
  args: string[],
): CliOptions {
  const rawCommand = args[0] ?? "help"
  if (
    rawCommand !== "list" &&
    rawCommand !== "search" &&
    rawCommand !== "show" &&
    rawCommand !== "activity" &&
    rawCommand !== "help" &&
    rawCommand !== "--help" &&
    rawCommand !== "-h"
  ) {
    throw new Error(`Unknown command "${rawCommand}"`)
  }

  const command = rawCommand === "--help" || rawCommand === "-h" ? "help" : rawCommand
  let source: Provider | "all" = "all"
  let cwd: string | undefined
  let limit = command === "activity" ? Number.MAX_SAFE_INTEGER : 20
  let archived = false
  let tools = false
  let timestamps = false
  let format: "markdown" | "json" = "markdown"
  let on: string | undefined
  let since: string | undefined
  let until: string | undefined
  const positional: string[] = []

  for (let index = 1; index < args.length; index++) {
    const argument = args[index]

    if (argument === "--source") {
      const value = args[++index]
      if (value !== "all" && value !== "claude" && value !== "codex") {
        throw new Error("--source must be all, claude, or codex")
      }
      source = value
      continue
    }

    if (argument === "--cwd") {
      cwd = args[++index]
      if (!cwd) throw new Error("--cwd requires a path")
      continue
    }

    if (argument === "--limit") {
      limit = Number(args[++index])
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("--limit requires a positive integer")
      }
      continue
    }

    if (argument === "--archived") {
      archived = true
      continue
    }

    if (argument === "--tools") {
      tools = true
      continue
    }

    if (argument === "--timestamps") {
      timestamps = true
      continue
    }

    if (argument === "--format") {
      const value = args[++index]
      if (value !== "markdown" && value !== "json") {
        throw new Error("--format must be markdown or json")
      }
      format = value
      continue
    }

    if (argument === "--on") {
      on = args[++index]
      if (!on) throw new Error("--on requires a calendar day")
      continue
    }

    if (argument === "--since") {
      since = args[++index]
      if (!since) throw new Error("--since requires a date or date-time")
      continue
    }

    if (argument === "--until") {
      until = args[++index]
      if (!until) throw new Error("--until requires a date or date-time")
      continue
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option "${argument}"`)
    }

    positional.push(argument)
  }

  if (command === "search" && positional.length === 0) {
    throw new Error("search requires a query")
  }

  if (command === "show" && positional.length !== 1) {
    throw new Error("show requires one session path, ID, or ID prefix")
  }

  if ((command === "list" || command === "activity") && positional.length > 0) {
    throw new Error(`${command} does not accept positional arguments`)
  }

  const timeWindow = parseTimeWindow(on, since, until)
  if (command === "activity" && !timeWindow) {
    throw new Error("activity requires --on, --since, or --until")
  }

  return {
    command,
    source,
    cwd,
    limit,
    archived,
    tools,
    timestamps,
    format,
    timeWindow,
    value: positional.join(" ") || undefined,
  }
}
