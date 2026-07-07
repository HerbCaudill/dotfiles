import { startBackgroundWorker } from "./startBackgroundWorker.ts"
import { writePendingSync } from "./writePendingSync.ts"

/** Queue a debounced background sync request. */
export function runBackgroundTrigger(
  /** The command arguments to run after syncing */
  args: string[],
) {
  const { repoRoot } = writePendingSync(args)

  startBackgroundWorker(repoRoot)
}
