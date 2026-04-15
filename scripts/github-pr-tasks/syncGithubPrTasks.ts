import { MAX_PROCESSED_EVENT_KEYS } from "./constants.ts"
import { getPendingPullRequestTasks } from "./getPendingPullRequestTasks.ts"
import type {
  GithubPrTaskState,
  SyncGithubPrTasksDependencies,
  SyncGithubPrTasksResult,
} from "./types.ts"

/** Coordinate one GitHub-to-Google-Tasks sync run. */
export async function syncGithubPrTasks(
  /** The side-effecting collaborators used by the sync. */
  dependencies: SyncGithubPrTasksDependencies,
): Promise<SyncGithubPrTasksResult> {
  const state = await dependencies.loadState()
  const startedAt = dependencies.now()
  const notifications = await dependencies.listNotifications(state.lastCheckedAt)
  const pendingTasks = getPendingPullRequestTasks(notifications, state.processedEventKeys)

  let nextState: GithubPrTaskState = {
    lastCheckedAt: startedAt,
    processedEventKeys: [...state.processedEventKeys],
  }

  for (const pendingTask of pendingTasks) {
    await dependencies.createTask(pendingTask.task)

    nextState = {
      lastCheckedAt: startedAt,
      processedEventKeys: [...nextState.processedEventKeys, pendingTask.eventKey].slice(
        -MAX_PROCESSED_EVENT_KEYS,
      ),
    }

    await dependencies.saveState(nextState)
  }

  if (pendingTasks.length === 0) {
    await dependencies.saveState(nextState)
  }

  return {
    checkedCount: notifications.length,
    createdCount: pendingTasks.length,
  }
}
