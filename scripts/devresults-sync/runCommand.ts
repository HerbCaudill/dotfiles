import { spawnSync } from "node:child_process"

/** Run a local command and return stdout without its trailing newline. */
export function runCommand(
  /** The command name */
  command: string,
  /** The command arguments */
  args: string[],
) {
  const result = spawnSync(command, args, { encoding: "utf8" })

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `${command} failed`
    throw new Error(detail)
  }

  return result.stdout.trimEnd()
}
