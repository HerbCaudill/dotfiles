import { RELEVANT_NOTIFICATION_REASONS } from "./constants.ts"
import { getNotificationEventKey } from "./getNotificationEventKey.ts"
import { getPullRequestLink } from "./getPullRequestLink.ts"
import type { GithubNotification, PendingPullRequestTask } from "./types.ts"

/** Return pending Google Tasks for relevant GitHub pull request notifications. */
export function getPendingPullRequestTasks(
  /** The notifications returned by GitHub. */
  notifications: GithubNotification[],
  /** The event keys that were already processed. */
  processedEventKeys: string[],
): PendingPullRequestTask[] {
  const processedEventKeySet = new Set(processedEventKeys)
  const relevantNotificationReasonSet = new Set<string>(RELEVANT_NOTIFICATION_REASONS)

  return [...notifications]
    .sort((left, right) => left.updated_at.localeCompare(right.updated_at))
    .filter(notification => notification.subject.type === "PullRequest")
    .filter(notification => relevantNotificationReasonSet.has(notification.reason))
    .map(notification => ({
      eventKey: getNotificationEventKey(notification),
      notification,
      task: {
        title: `PR: ${notification.subject.title}`,
        notes: getPullRequestLink(notification.subject.url),
      },
    }))
    .filter(task => !processedEventKeySet.has(task.eventKey))
}
