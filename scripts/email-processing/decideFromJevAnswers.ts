import type {
  ArchiveClassification,
  ArchiveProtections,
  GmailCategory,
  PromoteClassification,
} from "./types.ts"

/** Turn Jev's calibrated answers into the supervisor's archive, promote and unsubscribe decisions. */
export function decideFromJevAnswers(
  /** Jev answers plus the deterministic facts the supervisor computed. */
  input: JevDecisionInput,
): JevDecision {
  const { answers, archiveProtections } = input
  const mailKind = answers.mail_kind.choice as MailKind
  const probabilityOf = (kind: MailKind) => answers.mail_kind.probabilities[kind] ?? 0
  const protections = PROTECTIONS.filter(name => archiveProtections[name])
  const unprotected = protections.length === 0
  const isMarketing = probabilityOf("marketing") >= MARKETING_THRESHOLD
  const marketingProtections = MARKETING_PROTECTIONS.filter(name => archiveProtections[name])

  const unsubscribeBlockedBy = [
    ...(isMarketing ? [] : ["not-marketing"]),
    ...(input.oneClickUnsubscribe ? [] : ["no-one-click"]),
    ...(isDevResultsList(input) ? ["devresults-list"] : []),
    ...(archiveProtections.priorReply ? ["priorReply"] : []),
    ...marketingProtections,
  ]
  const unsubscribe = {
    eligible: unsubscribeBlockedBy.length === 0,
    blockedBy: unsubscribeBlockedBy,
  }

  if (unprotected && probabilityOf("cold_outreach") >= ARCHIVE_THRESHOLD) {
    const classification = toKebab(answers.cold_type.choice) as ArchiveClassification
    return { mailKind, decision: "archive", classification, unsubscribe }
  }
  // Herb wants no marketing at all, so it leaves the inbox in every tab, unsubscribed or not.
  if (isMarketing && marketingProtections.length === 0) {
    return { mailKind, decision: "archive", classification: "marketing", unsubscribe }
  }
  if (
    input.category !== "primary" &&
    answers.needs_attention.noul >= PROMOTE_THRESHOLD &&
    answers.routine_authentication.noul < ROUTINE_AUTHENTICATION_THRESHOLD
  ) {
    const classification = toKebab(answers.attention_reason.choice) as PromoteClassification
    return { mailKind, decision: "promote", classification, unsubscribe }
  }
  return { mailKind, decision: "none", classification: "no-action", unsubscribe }
}

/** Check whether the message belongs to a DevResults list, where unsubscribing would leave a group. */
function isDevResultsList(
  /** Decision input. */
  input: JevDecisionInput,
) {
  return input.senderAddress.endsWith("@devresults.com") || /devresults\.com/i.test(input.listId)
}

/** Convert Jev's snake_case option names to the supervisor's kebab-case classifications. */
function toKebab(
  /** Snake-case option name. */
  value: string,
) {
  return value.replaceAll("_", "-")
}

// CONSTANTS

/** Minimum probability that a message is marketing before archiving it or unsubscribing. */
export const MARKETING_THRESHOLD = 0.8

/** Minimum probability of cold outreach before archiving. */
export const ARCHIVE_THRESHOLD = 0.85

/** Minimum probability that a message needs attention before promoting it. */
export const PROMOTE_THRESHOLD = 0.7

/** Probability of routine authentication mail at which promotion is blocked. */
export const ROUTINE_AUTHENTICATION_THRESHOLD = 0.5

// Any of these means Herb has a relationship with the sender, so never archive or unsubscribe.
const PROTECTIONS = [
  "devResultsSender",
  "priorReply",
  "archiveReversal",
  "protectedCorrespondent",
  "activeConversation",
  "requestedWork",
  "herbInitiated",
] as const satisfies readonly (keyof ArchiveProtections)[]

// Signals strong enough to keep clear marketing. The others misfire on marketing: Google Groups
// forwarding makes vendors look like DevResults senders, promotional copy trips the correspondent
// keywords, and one old reply to a company doesn't mean Herb wants its campaigns. Unsubscribing
// also respects a prior reply, because it is harder to undo than an archive.
const MARKETING_PROTECTIONS = [
  "archiveReversal",
  "activeConversation",
  "requestedWork",
  "herbInitiated",
] as const satisfies readonly (keyof ArchiveProtections)[]

// TYPES

/** Kinds of mail the Jev mail_kind question distinguishes. */
export type MailKind =
  | "personal"
  | "cold_outreach"
  | "marketing"
  | "editorial"
  | "transactional"
  | "notification"
  | "government"

/** Jev answer to a Choice question. */
export type JevChoiceAnswer = {
  /** Answer type. */
  type: "choice"
  /** Highest-probability option. */
  choice: string
  /** Spread-based confidence from 0 to 1. */
  confidence: number
  /** Probability per option. */
  probabilities: Record<string, number>
}

/** Jev answer to a Noul question. */
export type JevNoulAnswer = {
  /** Answer type. */
  type: "noul"
  /** Probability that the claim is true. */
  noul: number
}

/** Answers to the questions in jevQuestions.json. */
export type JevAnswers = {
  /** What kind of mail this is. */
  mail_kind: JevChoiceAnswer
  /** Which kind of cold pitch it would be. */
  cold_type: JevChoiceAnswer
  /** Whether Herb should notice it soon. */
  needs_attention: JevNoulAnswer
  /** Why Herb should notice it. */
  attention_reason: JevChoiceAnswer
  /** Whether it is only a routine code or sign-in link. */
  routine_authentication: JevNoulAnswer
}

/** Everything the decision needs for one message. */
export type JevDecisionInput = {
  /** Jev answers for the message. */
  answers: JevAnswers
  /** Gmail category when the message arrived. */
  category: GmailCategory
  /** Exact lowercase sender address. */
  senderAddress: string
  /** Raw List-Id header, or an empty string. */
  listId: string
  /** Whether the message carries an https one-click List-Unsubscribe header. */
  oneClickUnsubscribe: boolean
  /** Deterministic protections computed by the supervisor. */
  archiveProtections: ArchiveProtections
}

/** Actions the supervisor would take for one message. */
export type JevDecision = {
  /** Most likely mail kind. */
  mailKind: MailKind
  /** Label action. */
  decision: "archive" | "promote" | "none"
  /** Stable classification for the decision log. */
  classification: ArchiveClassification | "marketing" | PromoteClassification | "no-action"
  /** Whether to send a one-click unsubscribe, and what blocked it otherwise. */
  unsubscribe: { eligible: boolean; blockedBy: string[] }
}
