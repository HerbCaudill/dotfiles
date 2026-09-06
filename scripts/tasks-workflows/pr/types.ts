import type { GithubNotification } from "../../github-pr-tasks/types.ts"

/** One immutable notification intention plus its confirmed recovery progress. */
export type PrIntent = {
  /** Existing notification.id:updated_at identity, unchanged from the old checkpoint. */
  eventKey: string
  /** Original title supplied to capture; retries never use a later human title. */
  title: string
  /** Full original PR URL description draft. */
  notes: string
  /** Stable private service receipt for capture. */
  captureRequestId: string
  /** Stable private service receipt and submission identity for notes. */
  descriptionRequestId: string
  /** Last durably recorded phase. */
  phase: "prepared" | "captured" | "saved"
  /** Confirmed Tasks identity, retained even after completion or renaming. */
  taskId?: string
}

/** Extended state retains existing checkpoints and unknown historical fields. */
export type PrState = {
  /** Previous complete poll boundary, never advanced by a partial batch. */
  lastCheckedAt: string | null
  /** Every original successful event plus newly acknowledged events. */
  processedEventKeys: string[]
  /** Immutable Tasks intentions, indexed by the original event key. */
  intents: Record<string, PrIntent>
  /** Historical checkpoint fields survive conversion unchanged. */
  [field: string]: unknown
}

/** Side-effect boundaries for one serialized poll. */
export type PrSyncDependencies = {
  /** Start of this poll, after the state is loaded. */
  now: () => string
  /** Read a validated private checkpoint. */
  loadState: () => Promise<PrState>
  /** Atomically persist each intention or acknowledged phase. */
  saveState: (state: PrState) => Promise<void>
  /** Fetch every GitHub notification page since the previous complete poll. */
  listNotifications: (since: string | null) => Promise<GithubNotification[]>
  /** Complete only the stored intention, reporting progress before another phase begins. */
  completeEvent: (
    intent: PrIntent,
    checkpoint: (intent: PrIntent) => Promise<void>,
  ) => Promise<PrIntent>
}

/** Minimal runtime evidence required from a successful CLI response. */
export type ServingMetadata = {
  /** Bound Tasks space selected during the reviewed service enrollment. */
  spaceId: string
  /** Observation instant, not a claim of independent replica convergence. */
  observedAt: string
  /** Calendar zone explicitly supplied by this scheduled workflow. */
  timezone: string
}

/** The CLI envelope fields used by the PR adapter. */
export type TasksResponse = {
  /** Exact shared protocol outcome. */
  status: "ok" | "saved" | "invalid" | "conflict" | "unavailable" | "unconfirmed"
  /** Acknowledged request, when this was a write or receipt lookup. */
  requestId?: string
  /** Current service context, separate from historical write records. */
  metadata?: ServingMetadata
  /** Historical write result or fresh query result. */
  result?: {
    /** Shared contract outcome. */
    status: string
    /** Exact created IDs returned by a successful capture. */
    createdIds?: string[]
    /** Authoritative affected IDs returned by the description write. */
    affectedIds?: string[]
    /** Saved typed records, used to check the capture identity. */
    records?: { id: string; kind: string; creationKey?: string | null }[]
  }
  /** Retained receipt evidence permits only the protocol's explicit safe retry. */
  receipt?: { request: { requestId: string }; phase: string }
}

/** Injected CLI boundary; known nonzero outcomes remain structured responses. */
export type TasksCall = (
  command: string,
  input: Record<string, unknown>,
  requestId?: string,
) => Promise<TasksResponse>
