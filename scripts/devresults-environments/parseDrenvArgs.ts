import { assertEnvironmentId } from "./assertEnvironmentId.ts"
import type { DrenvArgs } from "./types.ts"

/** Parse a strict, identity-explicit personal CLI without invoking a shell. */
export function parseDrenvArgs(
  /** Arguments following the executable name. */
  argv: string[],
): DrenvArgs {
  if (argv[0] === "--host") {
    const host = argv[1]
    if (!host || !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host)) throw new Error("Invalid Windows host")
    return { ...parseDrenvArgs(argv.slice(2)), host }
  }
  if (!argv.length || argv[0] === "--help") return { command: "help" }
  if (argv[0] === "request") {
    if (argv.length !== 2 || !/^[a-f0-9-]{36}$/.test(argv[1]))
      throw new Error("request requires a request UUID")
    return { command: "request", id: argv[1] }
  }
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
      ![
        "--preset",
        "--revision",
        "--database",
        "--instance",
        "--source",
        "--snapshot",
        "--vibe-source",
        "--vibe-revision",
        "--name",
      ].includes(option)
    )
      throw new Error(`Unknown option: ${option}`)
    const value = rest.shift()
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}`)
    if (command === "route") {
      if (option === "--name") {
        if (result.name !== undefined) throw new Error(`Duplicate option: ${option}`)
        result.name = value
      } else if (option === "--instance") result.instances = [...(result.instances ?? []), value]
      else throw new Error(`${option} is not valid for route`)
      continue
    }
    if (option === "--name") throw new Error("--name is only valid for route")
    if (command !== "create") throw new Error(`${option} is only valid for create`)
    const key = (
      option === "--vibe-source"
        ? "vibeSource"
        : option === "--vibe-revision"
          ? "vibeRevision"
          : option.slice(2)
    ) as
      | "vibeSource"
      | "vibeRevision"
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
  "install-vibe",
  "create",
  "sync",
  "watch",
  "start",
  "status",
  "url",
  "open",
  "stop",
  "snapshot",
  "reset",
  "remove",
  "recover",
  "refresh-db",
  "route",
  "help",
]
