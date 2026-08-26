import { spawn } from "node:child_process"

/** Run one child process with bounded time and combined output. */
export function runBoundedProcess(
  /** Exact process request. */
  request: ProcessRequest,
): Promise<ProcessResult> {
  if (request.timeoutMs <= 0) throw new Error("Process timeout must be positive")
  if (request.maxOutputBytes <= 0) throw new Error("Process output limit must be positive")

  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32"
    const child = spawn(request.command, [...request.args], {
      cwd: request.cwd,
      detached,
      env: request.env,
      stdio: ["pipe", "pipe", "pipe"],
    })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let outputBytes = 0
    let failure: Error | null = null
    let settled = false

    /** Stop the process tree and preserve the first failure. */
    const stop = (error: Error) => {
      if (failure) return
      failure = error
      killProcessTree(child.pid, child.kill.bind(child), detached)
    }

    const timeout = setTimeout(
      () => stop(new Error(`Process timed out after ${request.timeoutMs} ms`)),
      request.timeoutMs,
    )

    /** Capture one output chunk or stop once the shared limit is exceeded. */
    const capture = (chunks: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.byteLength
      if (outputBytes > request.maxOutputBytes) {
        stop(new Error(`Process output limit of ${request.maxOutputBytes} bytes exceeded`))
        return
      }
      chunks.push(chunk)
    }

    child.stdout.on("data", (chunk: Buffer) => capture(stdoutChunks, chunk))
    child.stderr.on("data", (chunk: Buffer) => capture(stderrChunks, chunk))
    child.stdin.on("error", () => {
      // A child may close stdin before consuming all input; its exit status remains authoritative.
    })
    child.on("error", error => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", code => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (failure) {
        reject(failure)
        return
      }
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      })
    })

    child.stdin.end(request.stdin)
  })
}

/** Kill a detached POSIX process group, with a direct-child fallback. */
function killProcessTree(
  /** Child process identifier. */
  pid: number | undefined,
  /** Direct child termination fallback. */
  killChild: (signal?: NodeJS.Signals | number) => boolean,
  /** Whether the process owns a detached process group. */
  detached: boolean,
): void {
  if (detached && pid !== undefined) {
    try {
      process.kill(-pid, "SIGKILL")
      return
    } catch {
      // The child may have exited between the limit check and process-group termination.
    }
  }

  try {
    killChild("SIGKILL")
  } catch {
    // A concurrent child exit already achieved the requested terminal state.
  }
}

// TYPES

/** Bounded child-process request. */
export type ProcessRequest = {
  /** Executable path or command name. */
  command: string
  /** Exact argument vector. */
  args: readonly string[]
  /** Child working directory. */
  cwd: string
  /** Complete child environment. */
  env: NodeJS.ProcessEnv
  /** UTF-8 standard input. */
  stdin: string
  /** Maximum wall-clock duration. */
  timeoutMs: number
  /** Maximum combined stdout and stderr bytes. */
  maxOutputBytes: number
}

/** Completed child-process result. */
export type ProcessResult = {
  /** Numeric process exit code. */
  code: number
  /** Complete bounded standard output. */
  stdout: string
  /** Complete bounded standard error. */
  stderr: string
}

/** Injectable bounded-process boundary. */
export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>
