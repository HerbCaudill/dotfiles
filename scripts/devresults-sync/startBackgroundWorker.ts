import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs"
import { spawn } from "node:child_process"

import { isProcessRunning } from "./isProcessRunning.ts"
import { getSyncStatePaths } from "./getSyncStatePaths.ts"

/** Start a detached background sync worker if one is not already running. */
export function startBackgroundWorker(
  /** The repository root path */
  repoRoot: string,
) {
  const paths = getSyncStatePaths(repoRoot)

  mkdirSync(paths.directory, { recursive: true })

  if (existsSync(paths.pidFile)) {
    const pid = Number(readFileSync(paths.pidFile, "utf8"))
    if (Number.isInteger(pid) && isProcessRunning(pid)) return false
  }

  const logFd = openSync(paths.logFile, "a")
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", process.argv[1] ?? "", "--worker"],
    {
      cwd: repoRoot,
      detached: true,
      env: process.env,
      stdio: ["ignore", logFd, logFd],
    },
  )

  writeFileSync(paths.pidFile, String(child.pid))
  child.unref()

  return true
}
