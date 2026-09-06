import { spawn } from "node:child_process"

/** Call the managed CLI with bounded UTF-8 input/output and no shell or peer database access. */
export async function runTasksCommand(
  /** Named command and literal options. */
  args: string[],
  /** One JSON request, written only to stdin. */
  input: string,
  /** Managed launcher, replaceable with a disposable process fixture. */
  executable = "tasks",
): Promise<{ code: number | null; stdout: string }> {
  const child = spawn(executable, args, { stdio: ["pipe", "pipe", "ignore"] })
  const closed = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", resolve)
  })
  let stdout = ""
  let bytes = 0
  let interrupted = false
  child.stdout.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    bytes += Buffer.byteLength(chunk)
    if (bytes > 16 * 1024 * 1024) {
      interrupted = true
      child.kill("SIGKILL")
    } else stdout += chunk
  })
  child.stdin.on("error", () => {})
  child.stdin.end(input)
  const timeout = setTimeout(() => {
    interrupted = true
    child.kill("SIGKILL")
  }, 75_000)
  try {
    const code = await closed
    if (interrupted || code === null)
      throw new Error("Tasks reply was interrupted; retain the original request for inspection")
    return { code, stdout }
  } finally {
    clearTimeout(timeout)
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
    await closed.catch(() => {})
  }
}
