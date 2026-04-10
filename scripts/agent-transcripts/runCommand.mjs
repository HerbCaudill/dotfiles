import { spawnSync } from "node:child_process"

/** Run a command and return its result or throw on failure. */
export const runCommand = (
  /** The executable to invoke. */
  command,
  /** The argument list passed to the executable. */
  args,
  /** Optional spawn settings. */
  options = {},
) => {
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
