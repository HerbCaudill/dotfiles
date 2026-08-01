import type { CliOptions, Provider } from "./types.ts"

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
    rawCommand !== "help" &&
    rawCommand !== "--help" &&
    rawCommand !== "-h"
  ) {
    throw new Error(`Unknown command "${rawCommand}"`)
  }

  const command = rawCommand === "--help" || rawCommand === "-h" ? "help" : rawCommand
  let source: Provider | "all" = "all"
  let cwd: string | undefined
  let limit = 20
  let archived = false
  let tools = false
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

  return {
    command,
    source,
    cwd,
    limit,
    archived,
    tools,
    value: positional.join(" ") || undefined,
  }
}
