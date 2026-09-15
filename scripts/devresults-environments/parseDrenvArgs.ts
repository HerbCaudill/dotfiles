import { assertEnvironmentId } from "./assertEnvironmentId.ts"
import type { DrenvArgs } from "./types.ts"

/** Parse a strict, identity-explicit personal CLI without invoking a shell. */
export function parseDrenvArgs(
  /** Arguments following the executable name. */
  argv: string[],
): DrenvArgs {
  if (!argv.length || argv[0] === "--help") return { command: "help" }
  const [command, ...rest] = argv
  if (!commands.includes(command as DrenvArgs["command"]))
    throw new Error(`Unknown command: ${command}`)
  const result: DrenvArgs = { command: command as DrenvArgs["command"] }
  if (rest[0] && !rest[0].startsWith("--")) result.id = rest.shift()
  if (result.id) assertEnvironmentId(result.id)
  if (!result.id && command !== "status" && command !== "help")
    throw new Error(`${command} requires an environment ID`)
  while (rest.length) {
    const option = rest.shift()!
    if (
      !["--preset", "--revision", "--database", "--instance", "--source", "--snapshot"].includes(
        option,
      )
    )
      throw new Error(`Unknown option: ${option}`)
    if (command !== "create") throw new Error(`${option} is only valid for create`)
    const value = rest.shift()
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}`)
    const key = option.slice(2) as
      | "preset"
      | "revision"
      | "database"
      | "instance"
      | "source"
      | "snapshot"
    if (result[key] !== undefined) throw new Error(`Duplicate option: ${option}`)
    if (key === "preset") {
      if (value !== "default" && value !== "inl") throw new Error("Preset must be default or inl")
      result.preset = value
    } else result[key] = value
  }
  return result
}

const commands: DrenvArgs["command"][] = [
  "create",
  "sync",
  "start",
  "status",
  "url",
  "open",
  "stop",
  "snapshot",
  "reset",
  "remove",
  "help",
]
