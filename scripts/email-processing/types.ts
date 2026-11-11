import type { PROMOTABLE_CATEGORIES } from "./constants.ts"

/** Gmail category normalized for policy evaluation. */
export type GmailCategory = "primary" | (typeof PROMOTABLE_CATEGORIES)[number]

/** Normalized mailbox identity kept as inert classifier data. */
export type NormalizedMailbox = {
  /** Human-readable display name, when Gmail supplied one. */
  name: string
  /** Lowercase exact email address. */
  address: string
}

/** Normalized prior message kept as inert classifier data. */
export type NormalizedThreadMessage = {
  /** Trusted Gmail mailbox receipt time in RFC 3339 format. */
  receivedAt: string
  /** Sender of the prior message. */
  sender: NormalizedMailbox
  /** Recipients of the prior message. */
  recipients: NormalizedMailbox[]
  /** Subject text from the prior message. */
  subject: string
  /** Complete meaningful body text from the prior message. */
  body: string
}

/** Signals of Herb's relationship with the sender, computed by the supervisor rather than Jev. */
export type ArchiveProtections = {
  /** Whether Herb previously sent mail to this exact sender. */
  priorReply: boolean
  /** Whether Herb previously reversed an archive for this exact sender. */
  archiveReversal: boolean
  /** Whether Herb has written in this thread. */
  activeConversation: boolean
  /** Whether Herb asked for something earlier in this thread. */
  requestedWork: boolean
  /** Whether Herb started this thread. */
  herbInitiated: boolean
}

/** Bulk-mail headers read from the message. */
export type BulkMailFacts = {
  /** Raw List-Id header, or an empty string. */
  listId: string
  /** Whether the message carries any List-Unsubscribe header. */
  listUnsubscribe: boolean
  /** The https URL for an RFC 8058 one-click unsubscribe, or null when the sender doesn't offer one. */
  oneClickUnsubscribeUrl: string | null
}

/** One normalized message the supervisor decides about. */
export type ClassifierCandidate = {
  /** Gmail message ID used as the opaque decision key. */
  messageId: string
  /** Gmail thread ID used by the supervisor for label changes. */
  threadId: string
  /** Trusted Gmail mailbox receipt time in RFC 3339 format. */
  receivedAt: string
  /** Exact normalized sender. */
  sender: NormalizedMailbox
  /** Exact normalized recipients. */
  recipients: NormalizedMailbox[]
  /** Message subject kept as inert text. */
  subject: string
  /** Complete meaningful message body kept as inert text. */
  body: string
  /** Earlier thread messages kept as inert text. */
  thread: NormalizedThreadMessage[]
  /** Gmail category when the message arrived. */
  category: GmailCategory
  /** Relationship signals computed by the supervisor. */
  archiveProtections: ArchiveProtections
  /** Bulk-mail headers. */
  bulkMail: BulkMailFacts
  /** METHOD of an attached iCalendar invitation (REQUEST, REPLY, CANCEL…), or null. */
  calendarMethod: string | null
  /** Whether the message is an automatic reply, from its Auto-Submitted or X-Autoreply headers. */
  autoReply: boolean
  /** Whether the message has Herb's Keep label, set by his Gmail filters or by hand. */
  keepLabeled: boolean
}

/** One of the two exact Gmail label deltas authorized by policy. */
export type LabelMutation = {
  /** Labels to add at thread level. */
  addLabelIds: readonly string[]
  /** Labels to remove at thread level. */
  removeLabelIds: readonly string[]
}
