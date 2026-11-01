import { spawn } from "node:child_process"
import type { Invocation, ProcessResult } from "./types.ts"

/** Start a harness, send it the prompt and capture its output. */
export function executeInvocation(
  /** The command to start. */
  invocation: Invocation,
  /** Prompt, working directory and time limit. */
  options: ExecuteInvocationOptions,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const timeout = setTimeout(() => child.kill(), options.timeoutMs)
    child.stdout.on("data", chunk => stdout.push(chunk))
    child.stderr.on("data", chunk => stderr.push(chunk))
    child.on("error", error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", code => {
      clearTimeout(timeout)
      resolve({
        code,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      })
    })
    child.stdin.end(options.prompt)
  })
}

export type ExecuteInvocationOptions = {
  /** Working directory. */
  cwd?: string
  /** Prompt sent on standard input. */
  prompt: string
  /** Time limit in milliseconds. */
  timeoutMs: number
}
