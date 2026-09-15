import { execFile } from "node:child_process"

/** Execute a bounded child directly; keep output and potentially sensitive arguments out of errors. */
export function runDrenvCommand(
  /** Explicit executable, argument vector and optional private stdin. */
  command: Command,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      command.executable,
      command.args,
      {
        cwd: command.cwd,
        shell: false,
        encoding: "utf8",
        timeout: command.timeoutMs ?? 120_000,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const reason = error.killed
            ? "terminated or timed out"
            : typeof error.code === "number"
              ? `exit ${error.code}`
              : "could not execute"
          reject(new Error(`Command failed (${reason}); command output withheld`))
        } else resolve({ stdout, stderr })
      },
    )
    // An early exit can close stdin before the supplied input has been consumed.
    child.stdin?.on("error", () => {})
    child.stdin?.end(command.input)
  })
}

/** One shell-free process invocation. Long-lived process supervision belongs to the lifecycle runner. */
type Command = {
  /** Resolved executable or command available on PATH. */
  executable: string
  /** Literal argument vector; never a joined shell command. */
  args: string[]
  /** Native working directory. */
  cwd?: string
  /** Private serialized payload, never logged by this runner. */
  input?: string
  /** Upper bound for short-lived command execution. */
  timeoutMs?: number
}
