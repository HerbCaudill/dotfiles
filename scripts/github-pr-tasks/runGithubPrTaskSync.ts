import { pathToFileURL } from "node:url"

import { createGoogleTask } from "./createGoogleTask.ts"
import { listGithubNotifications } from "./listGithubNotifications.ts"
import { loadGithubPrTaskState } from "./loadGithubPrTaskState.ts"
import { saveGithubPrTaskState } from "./saveGithubPrTaskState.ts"
import { syncGithubPrTasks } from "./syncGithubPrTasks.ts"

/** Run one end-to-end GitHub PR to Google Tasks sync. */
export async function runGithubPrTaskSync(): Promise<void> {
  const result = await syncGithubPrTasks({
    now: () => new Date().toISOString(),
    loadState: loadGithubPrTaskState,
    listNotifications: listGithubNotifications,
    createTask: createGoogleTask,
    saveState: saveGithubPrTaskState,
  })

  console.log(
    `[github-pr-task-sync] checked ${result.checkedCount} notifications, created ${result.createdCount} tasks`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGithubPrTaskSync().catch(error => {
    console.error(`[github-pr-task-sync] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
