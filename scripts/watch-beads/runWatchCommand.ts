import { spawn } from "node:child_process"

/** Run a bounded CLI request without a shell or exposing its stdout on failure. */
export function runWatchCommand(
  /** Executable resolved through the managed service PATH. */
  executable: string,
  /** Literal arguments, never shell text. */
  args: string[],
  /** Repository used for Beads workspace resolution. */
  cwd: string,
  /** Optional message delivered over stdin. */
  input?: string,
  /** Cancellation when a repository is unenrolled. */
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, signal, stdio: ["pipe", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    let failure: Error | undefined
    const timer = setTimeout(() => {
      failure = new Error(`${executable} timed out`)
      child.kill("SIGKILL")
    }, 60_000)
    child.stdout.on("data", chunk => {
      stdout += chunk
      if (stdout.length > 16_000_000) {
        failure = new Error(`${executable} exceeded the response limit`)
        child.kill("SIGKILL")
      }
    })
    child.stderr.on("data", chunk => {
      stderr = (stderr + chunk).slice(-4000)
    })
    child.stdin.on("error", () => {})
    child.stdin.end(input)
    child.on("error", error => {
      failure = error
    })
    child.on("close", code => {
      clearTimeout(timer)
      if (failure) reject(failure)
      else if (code !== 0) reject(new Error(`${executable} exited ${code}: ${stderr.slice(-1000)}`))
      else resolve(stdout)
    })
  })
}
