/** The notification reasons that should create Google Tasks. */
export const RELEVANT_NOTIFICATION_REASONS = ["assign", "review_requested"] as const

/** The number of processed event keys to retain in state. */
export const MAX_PROCESSED_EVENT_KEYS = 500

/** The Google Tasks task list identifier for the default list. */
export const DEFAULT_TASK_LIST_ID = "@default"
