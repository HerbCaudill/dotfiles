/** Anthropic weekly usage information used by the footer. */
export type WeeklyUsage = {
  /** The current weekly utilization percentage. */
  utilization: number
  /** The timestamp when the weekly usage window resets. */
  resetsAt: string
}

/** Cached weekly usage state. */
export type WeeklyUsageCache = {
  /** The time the cache was last refreshed. */
  fetchedAt: number
  /** The cached usage data, or null when unavailable. */
  value: WeeklyUsage | null
}
