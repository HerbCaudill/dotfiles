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

  const openPullRequestLinks = new Set(
    pendingTasks.length > 0 ? await dependencies.listOpenPullRequestLinks() : [],
  )
  let createdCount = 0

  let nextState: GithubPrTaskState = {
    lastCheckedAt: startedAt,
    processedEventKeys: [...state.processedEventKeys],
  }

  for (const pendingTask of pendingTasks) {
    const link = pendingTask.task.notes
    if (!link || !openPullRequestLinks.has(link)) {
      await dependencies.createTask(pendingTask.task)
      if (link) openPullRequestLinks.add(link)
      createdCount += 1
    }

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
    createdCount,
  }
}
