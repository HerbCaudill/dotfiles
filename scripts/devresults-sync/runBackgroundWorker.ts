import { existsSync, rmSync } from "node:fs"

import { BACKGROUND_DEBOUNCE_MS } from "./constants.ts"
import { getRepoRoot } from "./getRepoRoot.ts"
import { getSyncStatePaths } from "./getSyncStatePaths.ts"
import { readJsonFile } from "./readJsonFile.ts"
import { runDrsync } from "./runDrsync.ts"
import { sleep } from "./sleep.ts"

/** Run the debounced background sync worker. */
export async function runBackgroundWorker() {
  const repoRoot = getRepoRoot()
  const paths = getSyncStatePaths(repoRoot)

  try {
    while (existsSync(paths.pendingFile)) {
      const pending = readJsonFile<PendingSync>(paths.pendingFile)

      if (!pending) {
        rmSync(paths.pendingFile, { force: true })
        continue
      }

      const remainingMs = BACKGROUND_DEBOUNCE_MS - (Date.now() - pending.requestedAt)

      if (remainingMs > 0) {
        await sleep(remainingMs)
        continue
      }

      rmSync(paths.pendingFile, { force: true })
      await runDrsync(pending.args)
    }
  } finally {
    rmSync(paths.pidFile, { force: true })
  }
}

/** Pending background sync request. */
type PendingSync = {
  /** The command arguments to run after syncing */
  args: string[]
  /** The request timestamp */
  requestedAt: number
}
