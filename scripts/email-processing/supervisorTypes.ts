import type { ClassifierInput, LabelMutation } from "./types.ts"

/** Durable supervisor state stored outside the repository. */
export type EmailProcessingState = {
  /** Last Gmail history ID completed by the supervisor. */
  lastHistoryId: string | null
  /** Completion timestamp for the last run. */
  lastCompletedAt: string | null
  /** Message IDs that need another processing attempt. */
  retryMessageIds: string[]
  /** Original labels needed to replay a partially completed retry idempotently. */
  retryOriginalLabelIds?: Record<string, string[]>
  /** Exact sender addresses protected after archive reversals. */
  archiveReversalSenders: string[]
}

/** Append-only record of one processing outcome. */
export type DecisionLogEntry = {
  /** RFC 3339 timestamp for the outcome. */
  timestamp: string
  /** Opaque Gmail message ID. */
  messageId: string
  /** Opaque Gmail thread ID. */
  threadId: string
  /** Sender display name and exact address. */
  sender: string
  /** Sanitized subject text. */
  subject: string
  /** Labels present before processing. */
  originalLabels: string[]
  /** Supervisor outcome. */
  decision: "archive" | "promote" | "none" | "correction" | "error"
  /** Stable policy category. */
  classification: string
  /** Qualitative classifier certainty. */
  confidence: "high" | "medium" | "low"
  /** Sanitized concise explanation. */
  reason: string
  /** Raw inspected exception for an error outcome, including stack and custom properties. */
  exception?: string
  /** Sanitized stable evidence labels. */
  policySignals: string[]
  /** Direct Gmail conversation URL. */
  gmailUrl: string
}

/** Minimal Gmail profile fields used for synchronization. */
export type GmailProfile = {
  /** Current mailbox history ID. */
  historyId: string
}

/** Opaque Gmail message reference returned by discovery. */
export type GmailMessageReference = {
  /** Gmail message ID. */
  messageId: string
  /** Gmail thread ID, when included by the discovery response. */
  threadId?: string
}

/** One Gmail label transition from mailbox history. */
export type GmailLabelChange = {
  /** Gmail message ID affected by the transition. */
  messageId: string
  /** Labels added by the transition. */
  addedLabelIds: string[]
  /** Labels removed by the transition. */
  removedLabelIds: string[]
}

/** Gmail changes returned after a saved history ID. */
export type GmailHistory = {
  /** Messages added since the saved history ID. */
  addedMessages: GmailMessageReference[]
  /** Relevant message label transitions. */
  labelChanges: GmailLabelChange[]
}

/** One Gmail message header. */
export type GmailHeader = {
  /** Case-insensitive header name. */
  name: string
  /** Untrusted header value. */
  value: string
}

/** One Gmail MIME body segment. */
export type GmailMessagePartBody = {
  /** Base64url-encoded inline content, when present. */
  data?: string
  /** Attachment ID, which the supervisor never follows. */
  attachmentId?: string
}

/** Recursive Gmail MIME part used to extract inline text only. */
export type GmailMessagePart = {
  /** MIME type for this part. */
  mimeType?: string
  /** Attachment filename, when this part is an attachment. */
  filename?: string
  /** Part-specific headers. */
  headers?: GmailHeader[]
  /** Inline data or an ignored attachment reference. */
  body?: GmailMessagePartBody
  /** Nested MIME parts. */
  parts?: GmailMessagePart[]
}

/** Gmail message data needed for policy evaluation. */
export type GmailMessage = {
  /** Gmail message ID. */
  id: string
  /** Gmail thread ID. */
  threadId: string
  /** Current Gmail labels. */
  labelIds?: string[]
  /** MIME content and headers. */
  payload?: GmailMessagePart
}

/** Gmail thread data needed for context and verification. */
export type GmailThread = {
  /** Gmail thread ID. */
  id: string
  /** Thread history ID at fetch time. */
  historyId?: string
  /** Messages in chronological API order. */
  messages: GmailMessage[]
}

/** Gmail operations owned by the supervisor's only authorized external boundary. */
export type GmailClient = {
  /** Fetch the current mailbox profile. */
  getProfile: () => Promise<GmailProfile>
  /** Find current Inbox messages received after a timestamp. */
  listRecentInboxMessages: (after: Date) => Promise<GmailMessageReference[]>
  /** Fetch changes after a durable Gmail history ID. */
  listHistory: (startHistoryId: string) => Promise<GmailHistory>
  /** Fetch one message with its current labels and full inline content. */
  getMessage: (messageId: string) => Promise<GmailMessage>
  /** Fetch one complete thread. */
  getThread: (threadId: string) => Promise<GmailThread>
  /** Check Sent mail for a prior exact-address reply. */
  hasPriorReplyTo: (address: string) => Promise<boolean>
  /** Apply one validated thread-level label mutation. */
  modifyThreadLabels: (threadId: string, mutation: LabelMutation) => Promise<void>
}

/** Injectable side effects used by one supervisor run. */
export type GmailSupervisorDependencies = {
  /** Return the run's wall-clock time. */
  now: () => Date
  /** Fixed-account Gmail boundary. */
  gmail: GmailClient
  /** Run the isolated classifier adapter. */
  classify: (input: ClassifierInput) => Promise<unknown>
  /** Load durable state. */
  loadState: () => Promise<EmailProcessingState>
  /** Persist durable state. */
  saveState: (state: EmailProcessingState) => Promise<void>
  /** Load sanitized prior outcomes. */
  loadDecisionLog: () => Promise<DecisionLogEntry[]>
  /** Append one sanitized outcome. */
  appendDecision: (entry: DecisionLogEntry) => Promise<void>
}

/** Compact counts returned after a complete run. */
export type GmailSupervisorResult = {
  /** Successfully archived messages. */
  archived: number
  /** Successfully promoted messages. */
  promoted: number
  /** Messages intentionally left unchanged. */
  unchanged: number
  /** Messages saved for another attempt. */
  retried: number
  /** Untouched backlog messages intentionally left for a later bounded run. */
  pending: number
  /** Manual corrections learned during the run. */
  corrected: number
}

/** Explicit signal that Gmail no longer accepts a saved history ID. */
export class ExpiredGmailHistoryError extends Error {
  /** Create an expired-history error without retaining Gmail response content. */
  constructor() {
    super("Gmail history ID expired")
    this.name = "ExpiredGmailHistoryError"
  }
}
