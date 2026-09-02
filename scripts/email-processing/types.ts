import type { EMAIL_PROCESSING_ACCOUNT, PROMOTABLE_CATEGORIES } from "./constants.ts"

/** Fixed Gmail account accepted by the classifier contract. */
export type EmailProcessingAccount = typeof EMAIL_PROCESSING_ACCOUNT

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

/** Deterministic archive protections computed outside the classifier. */
export type ArchiveProtections = {
  /** Whether the sender belongs to the supervised DevResults account domain. */
  devResultsSender: boolean
  /** Whether Herb previously replied to this exact sender. */
  priorReply: boolean
  /** Whether Herb previously reversed an archive for this exact sender. */
  archiveReversal: boolean
  /** Whether the sender is a protected personal or professional correspondent. */
  protectedCorrespondent: boolean
  /** Whether the message belongs to an active conversation. */
  activeConversation: boolean
  /** Whether the message concerns work Herb requested. */
  requestedWork: boolean
  /** Whether the message responds to something Herb initiated. */
  herbInitiated: boolean
}

/** Deterministic facts for the delegated-customer archive exception. */
export type DelegatedCustomerFacts = {
  /** Whether the message is a legitimate customer, demo, or procurement inquiry. */
  customerInquiry: boolean
  /** Whether another DevResults person is a recipient. */
  otherDevResultsRecipient: boolean
  /** Whether the message explicitly requires Herb to decide, reply, approve, attend, or act. */
  requiresHerbAction: boolean
}

/** Sanitized prior promotion correction supplied as inert classifier evidence. */
export type PromotionCorrectionEvidence = {
  /** Timestamp of the observed manual correction. */
  timestamp: string
  /** Direction of the manual promotion correction. */
  correction: "promotion-reversed" | "promotion-missed"
  /** Exact sender from the corrected message. */
  sender: NormalizedMailbox
  /** Sanitized subject from the corrected message. */
  subject: string
  /** Whether the correction sender exactly matches the current candidate sender. */
  exactSender: boolean
  /** Stable category assigned before Herb corrected the promotion decision. */
  priorClassification: string
  /** Sanitized explanation recorded before Herb corrected the promotion decision. */
  priorReason: string
  /** Sanitized evidence labels recorded before Herb corrected the promotion decision. */
  priorPolicySignals: string[]
}

/** Normalized candidate supplied to the isolated classifier. */
export type ClassifierCandidate = {
  /** Gmail message ID used as the opaque decision key. */
  messageId: string
  /** Gmail thread ID used by the supervisor after validation. */
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
  /** Relevant thread messages kept as inert text. */
  thread: NormalizedThreadMessage[]
  /** Current Gmail category. */
  category: GmailCategory
  /** Archive protections computed by the supervisor. */
  archiveProtections: ArchiveProtections
  /** Facts used only for the delegated-customer exception. */
  delegatedCustomer: DelegatedCustomerFacts
  /** Recent sanitized promotion corrections for specific-example evidence. */
  promotionCorrections: PromotionCorrectionEvidence[]
}

/** Strict input contract supplied to the classifier. */
export type ClassifierInput = {
  /** Stable wall-clock time for freshness comparisons. */
  evaluatedAt: string
  /** Content-derived version of the canonical classifier prompt. */
  policyVersion: string
  /** Fixed supervised Gmail account. */
  account: EmailProcessingAccount
  /** Exact set of candidates the classifier may name. */
  candidates: ClassifierCandidate[]
}

/** Stable archive classifications recognized by policy. */
export type ArchiveClassification =
  | "cold-vendor"
  | "cold-job-inquiry"
  | "cold-investor"
  | "generic-solicitation"
  | "misfiled-marketing"
  | "delegated-customer"

/** Stable promotion classifications recognized by policy. */
export type PromoteClassification =
  | "personal-message"
  | "explicit-action"
  | "scheduling-exception"
  | "account-security"
  | "operational-failure"
  | "medical-action"
  | "financial-anomaly"
  | "service-decision"
  | "active-work"

/** Stable classification used when no Gmail action is warranted. */
export type NoneClassification = "no-action"

/** Evidence and explanation fields common to every classifier decision. */
export type ClassifierDecisionEvidence = {
  /** Candidate message ID copied from the offered input. */
  messageId: string
  /** One concise explanation that contains no executable authority. */
  reason: string
  /** Short inert evidence labels supporting the classification. */
  policySignals: string[]
}

/** High-confidence request to archive an eligible message. */
export type ArchiveDecision = ClassifierDecisionEvidence & {
  /** Requested policy action. */
  decision: "archive"
  /** Stable unwanted-mail or delegated-customer category. */
  classification: ArchiveClassification
  /** Archive decisions require high confidence. */
  confidence: "high"
}

/** Medium- or high-confidence request to promote an eligible message. */
export type PromoteDecision = ClassifierDecisionEvidence & {
  /** Requested policy action. */
  decision: "promote"
  /** Stable attention-worthy category. */
  classification: PromoteClassification
  /** Promotion decisions reject ambiguous low-confidence results. */
  confidence: "high" | "medium"
}

/** Request to leave a message unchanged. */
export type NoneDecision = ClassifierDecisionEvidence & {
  /** Requested policy action. */
  decision: "none"
  /** Stable no-action category. */
  classification: NoneClassification
  /** Classifier certainty for a no-action decision. */
  confidence: "high" | "medium" | "low"
}

/** One strict classifier decision variant. */
export type ClassifierDecision = ArchiveDecision | PromoteDecision | NoneDecision

/** Strict structured result returned by the classifier. */
export type ClassifierOutput = {
  /** One decision for every offered candidate. */
  decisions: ClassifierDecision[]
}

/** One of the two exact Gmail label deltas authorized by policy. */
export type LabelMutation = {
  /** Labels to add at thread level. */
  addLabelIds: readonly string[]
  /** Labels to remove at thread level. */
  removeLabelIds: readonly string[]
}

/** Classifier decision enriched only with supervisor-controlled execution data. */
export type ValidatedClassification = ClassifierDecision & {
  /** Thread ID resolved from the offered candidate rather than classifier output. */
  threadId: string
  /** Exact authorized mutation, or null for no action. */
  mutation: LabelMutation | null
}

/** JSON Schema shape exported for structured classifier invocation. */
export type JsonSchema = Readonly<Record<string, unknown>>
