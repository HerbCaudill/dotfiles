import { mkdirSync, writeFileSync } from "node:fs"

import { getRepoRoot } from "./getRepoRoot.ts"
import { getSyncStatePaths } from "./getSyncStatePaths.ts"

/** Write a pending background sync request. */
export function writePendingSync(
  /** The command arguments to run after syncing */
  args: string[],
) {
  const repoRoot = getRepoRoot()
  const paths = getSyncStatePaths(repoRoot)

  mkdirSync(paths.directory, { recursive: true })
  writeFileSync(
    paths.pendingFile,
    JSON.stringify({
      args,
      requestedAt: Date.now(),
    }),
  )

  return {
    paths,
    repoRoot,
  }
}
