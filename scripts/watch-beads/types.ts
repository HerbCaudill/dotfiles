/** Fields used to decide whether Beads work belongs to an agent. */
export type ReadyIssue = {
  id: string
  status?: string
  issue_type?: string
  assignee?: string
  labels?: string[]
}

/** Last successfully reconciled readiness and capacity snapshot. */
export type WatchSnapshot = { ready: string[]; active: string[] }

/** One repository's explicitly enrolled orchestration thread. */
export type WatchConfig = { repo: string; thread: string; t3Home?: string }

/** Private state persisted separately from enrollment configuration. */
export type WatchState = {
  thread: string
  snapshot?: WatchSnapshot
  lastCheck?: string
  lastWake?: string
  lastError?: string
}

/** Process receipt that distinguishes a daemon from an unrelated reused PID. */
export type DaemonReceipt = { pid: number; identity: string; startedAt: string }
