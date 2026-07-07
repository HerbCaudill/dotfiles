import { join } from "node:path"

import { getSyncStateDirectory } from "./getSyncStateDirectory.ts"

/** Get state file paths for a repository's background sync. */
export function getSyncStatePaths(
  /** The repository root path */
  repoRoot: string,
) {
  const directory = getSyncStateDirectory(repoRoot)

  return {
    directory,
    logFile: join(directory, "drsync.log"),
    pendingFile: join(directory, "pending.json"),
    pidFile: join(directory, "worker.pid"),
  }
}
