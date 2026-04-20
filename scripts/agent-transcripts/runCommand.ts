import { spawnSync } from "node:child_process"
import type { SpawnSyncOptions, SpawnSyncReturns } from "node:child_process"

/** The supported spawn options for commands that always use UTF-8 output. */
type CommandOptions = Omit<SpawnSyncOptions, "encoding">

/** Run a command and return its result or throw on failure. */
export const runCommand = (
  /** The executable to invoke. */
  command: string,
  /** The argument list passed to the executable. */
  args: string[],
  /** Optional spawn settings. */
  options: CommandOptions = {},
): SpawnSyncReturns<string> => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  })

  if (result.status === 0) {
    return result
  }

  const stderr = result.stderr?.trim()
  const stdout = result.stdout?.trim()
  const output = stderr || stdout || `exit ${result.status ?? "unknown"}`

  throw new Error(`${command} ${args.join(" ")} failed: ${output}`)
}
