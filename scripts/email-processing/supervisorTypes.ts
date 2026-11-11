import type { JevClassification, JevClassifyInput } from "./classifyWithJev.ts"
import type { LabelMutation } from "./types.ts"

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
  /** Content-derived version of the Jev questions and decision rules used for the decision. */
  policyVersion: string
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
  /** Qualitative certainty: high for rules, otherwise from Jev's probability for the deciding answer. */
  confidence: "high" | "medium" | "low"
  /** True when the job ran in log-only mode, so the decision was recorded but Gmail was not changed. */
  logOnly?: true
  /** Jev's model and the answers that drove the decision, rounded to two decimals. */
  jev?: JevLogSummary
  /** Whether the sender could be unsubscribed from, and what blocked it otherwise. */
  unsubscribe?: { eligible: boolean; blockedBy: string[] }
  /** Sanitized concise explanation. */
  reason: string
  /** Raw inspected exception for an error outcome, including stack and custom properties. */
  exception?: string
  /** Sanitized stable evidence labels. */
  policySignals: string[]
  /** Stable category from the decision Herb later corrected. */
  priorClassification?: string
  /** Sanitized explanation from the decision Herb later corrected. */
  priorReason?: string
  /** Sanitized evidence labels from the decision Herb later corrected. */
  priorPolicySignals?: string[]
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
  /** Gmail mailbox receipt time in milliseconds since the Unix epoch. */
  internalDate: string
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
  /** Fetch changes after a durable Gmail history ID. */
  listHistory: (startHistoryId: string) => Promise<GmailHistory>
  /** Fetch one message with its current labels and full inline content, or null when it's gone. */
  getMessage: (messageId: string) => Promise<GmailMessage | null>
  /** Fetch one complete thread. */
  getThread: (threadId: string) => Promise<GmailThread>
  /** Check whether any message in a thread is in Inbox, or null when the thread is gone. */
  isThreadInInbox: (threadId: string) => Promise<boolean | null>
  /** Fetch one attachment's base64url data. Used only for iCalendar parts. */
  getAttachmentData: (messageId: string, attachmentId: string) => Promise<string>
  /** Find a user label's ID by its exact name, or null when there is none. */
  getLabelIdByName: (name: string) => Promise<string | null>
  /** Check Sent mail for a prior exact-address reply. */
  hasPriorReplyTo: (address: string) => Promise<boolean>
  /** Apply one validated thread-level label mutation. */
  modifyThreadLabels: (threadId: string, mutation: LabelMutation) => Promise<void>
  /** List the mailbox's Gmail filters. */
  listFilters: () => Promise<GmailFilter[]>
  /** Create a filter that archives all mail from one exact address, returning its ID. */
  createArchiveFilter: (address: string) => Promise<string>
}

/** The parts of a Gmail filter used to check whether a sender is already covered. */
export type GmailFilter = {
  /** Filter ID. */
  id: string
  /** Gmail's from criterion, such as an address, a domain or an OR list. */
  from: string
  /** Labels the filter removes. */
  removeLabelIds: string[]
}

/** Jev's model and the answers that drove one decision. */
export type JevLogSummary = {
  /** Versioned Jev model. */
  model: string
  /** Most likely mail kind. */
  mailKind: string
  /** Probability that the message is marketing. */
  marketing: number
  /** Probability that Herb keeps the message in his inbox. */
  keep: number
}

/** A one-click unsubscribe the job found and queued for Herb's approval. */
export type UnsubscribeCandidate = {
  /** Exact lowercase sender address. */
  address: string
  /** Sender display name. */
  name: string
  /** Sanitized subject of the latest message, as an example. */
  sampleSubject: string
  /** RFC 8058 one-click https URL from the latest message. */
  url: string
  /** Gmail message ID of the latest message. */
  messageId: string
  /** Gmail thread ID of the latest message. */
  threadId: string
  /** Receipt time of the latest message. */
  receivedAt: string
}

/** Injectable side effects used by one supervisor run. */
export type GmailSupervisorDependencies = {
  /** Return the run's wall-clock time. */
  now: () => Date
  /** Fixed-account Gmail boundary. */
  gmail: GmailClient
  /** Ask Jev the policy questions about one message. */
  classify: (input: JevClassifyInput) => Promise<JevClassification>
  /** Record decisions without changing Gmail. */
  logOnly: boolean
  /** Queue a sender for Herb to approve unsubscribing from. */
  queueUnsubscribe: (candidate: UnsubscribeCandidate) => Promise<void>
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
  /** Archived messages, or messages that would have been archived in log-only mode. */
  archived: number
  /** Promoted messages, or messages that would have been promoted in log-only mode. */
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
