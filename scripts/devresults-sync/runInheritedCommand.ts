import { spawnSync } from "node:child_process"

/** Run a local command with inherited stdio and exit on failure. */
export function runInheritedCommand(
  /** The command name */
  command: string,
  /** The command arguments */
  args: string[],
) {
  const result = spawnSync(command, args, { stdio: "inherit" })

  if (result.signal) {
    console.error(`drsync: ${command} exited from signal ${result.signal}`)
    process.exit(1)
  }

  if (result.status !== 0) process.exit(result.status ?? 1)
}
