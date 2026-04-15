/** A GitHub notification thread returned by the notifications API. */
export type GithubNotification = {
  /** The notification thread identifier. */
  id: string
  /** The reason GitHub sent the notification. */
  reason: string
  /** The last time the thread was updated. */
  updated_at: string
  /** The subject attached to the notification. */
  subject: GithubNotificationSubject
}

/** The subject metadata for a GitHub notification thread. */
export type GithubNotificationSubject = {
  /** The user-visible title of the subject. */
  title: string
  /** The GitHub subject type. */
  type: string
  /** The API URL for the subject. */
  url: string | null
}

/** The state persisted between sync runs. */
export type GithubPrTaskState = {
  /** The timestamp used as the next GitHub notifications cursor. */
  lastCheckedAt: string | null
  /** The notification event keys that have already produced tasks. */
  processedEventKeys: string[]
}

/** The Google Task payload created for a pull request notification. */
export type GoogleTaskRequest = {
  /** The task title shown in Google Tasks. */
  title: string
  /** The task notes shown in Google Tasks. */
  notes: string
}

/** A pending task derived from a GitHub notification event. */
export type PendingPullRequestTask = {
  /** The unique event key for the notification update. */
  eventKey: string
  /** The source notification for the task. */
  notification: GithubNotification
  /** The Google Task request to create. */
  task: GoogleTaskRequest
}

/** The collaborators used by the sync orchestrator. */
export type SyncGithubPrTasksDependencies = {
  /** Return the current timestamp in ISO-8601 format. */
  now: () => string
  /** Load the last saved sync state. */
  loadState: () => Promise<GithubPrTaskState>
  /** Fetch notifications updated since the supplied cursor. */
  listNotifications: (lastCheckedAt: string | null) => Promise<GithubNotification[]>
  /** Create a Google Task from the supplied request. */
  createTask: (task: GoogleTaskRequest) => Promise<void>
  /** Persist the next sync state. */
  saveState: (state: GithubPrTaskState) => Promise<void>
}

/** The outcome of a sync run. */
export type SyncGithubPrTasksResult = {
  /** The number of notifications returned from GitHub. */
  checkedCount: number
  /** The number of Google Tasks created. */
  createdCount: number
}
