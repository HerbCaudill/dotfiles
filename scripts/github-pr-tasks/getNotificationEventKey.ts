import type { GithubNotification } from "./types.ts"

/** Build a stable event key for one notification update. */
export function getNotificationEventKey(
  /** The notification thread to key. */
  notification: GithubNotification,
): string {
  return `${notification.id}:${notification.updated_at}`
}
