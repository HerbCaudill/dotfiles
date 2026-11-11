import type { ArchiveProtections, GmailCategory } from "./types.ts"

/**
 * Turn Jev's calibrated answers into the supervisor's decisions. Herb keeps his inbox nearly empty,
 * so mail is archived unless something says to keep it: his Keep label, a calendar invitation, an undone archive,
 * personal mail from someone he knows, or Jev's judgment that Herb still has to read, answer or act
 * on it. Clear marketing is also
 * unsubscribed from when that is safe.
 */
export function decideFromJevAnswers(
  /** Jev answers plus the deterministic facts the supervisor computed. */
  input: JevDecisionInput,
): JevDecision {
  const { answers, archiveProtections } = input
  const mailKind = answers.mail_kind.choice as MailKind
  const isMarketing = (answers.mail_kind.probabilities.marketing ?? 0) >= MARKETING_THRESHOLD
  const keep = (classification: string): JevDecision => ({
    mailKind,
    decision: "none",
    classification,
    unsubscribe: { eligible: false, blockedBy: ["kept"] },
  })
  const archive = (classification: string): JevDecision => ({
    mailKind,
    decision: "archive",
    classification,
    unsubscribe: unsubscribeFor(input, isMarketing),
  })

  // Herb's own signals and message structure come before Jev's judgment.
  if (input.keepLabeled) return keep("keep-label")
  if (archiveProtections.archiveReversal) return keep("archive-reversal")
  if (input.calendarMethod === "REPLY") return archive("calendar-reply")
  if (input.calendarMethod) return keep("calendar-invitation")
  if (input.autoReply) return archive("auto-reply")
  if (isMarketing) return archive("marketing")
  // Archiving a real person is the costliest mistake, so personal mail from someone Herb has
  // written to, or in a conversation he is part of, stays even when Jev would archive it.
  if (
    (answers.mail_kind.probabilities.personal ?? 0) >= PERSONAL_THRESHOLD &&
    CORRESPONDENT_SIGNALS.some(name => archiveProtections[name])
  )
    return keep("correspondent")

  if (answers.keep_in_inbox.noul >= KEEP_THRESHOLD) {
    if (input.category === "primary") return keep("keep")
    return {
      mailKind,
      decision: "promote",
      classification: toKebab(answers.attention_reason.choice),
      unsubscribe: { eligible: false, blockedBy: ["kept"] },
    }
  }
  return archive(mailKind === "cold_outreach" ? toKebab(answers.cold_type.choice) : mailKind)
}

/** Decide whether archived mail should also be unsubscribed from, and what blocks it. */
function unsubscribeFor(
  /** Decision input. */
  input: JevDecisionInput,
  /** Whether Jev is confident the message is marketing. */
  isMarketing: boolean,
) {
  const blockedBy = [
    ...(isMarketing ? [] : ["not-marketing"]),
    ...(input.oneClickUnsubscribe ? [] : ["no-one-click"]),
    ...(isDevResultsList(input) ? ["devresults-list"] : []),
    // Unsubscribing is harder to undo than archiving, so a past reply to the sender blocks it.
    ...UNSUBSCRIBE_PROTECTIONS.filter(name => input.archiveProtections[name]),
  ]
  return { eligible: blockedBy.length === 0, blockedBy }
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

/** Minimum probability that a message is marketing before archiving it as marketing or unsubscribing. */
export const MARKETING_THRESHOLD = 0.8

/** Minimum probability that Herb keeps a message before leaving or promoting it. */
export const KEEP_THRESHOLD = 0.5

/** Minimum probability that a message is personal before a known correspondent keeps it. */
export const PERSONAL_THRESHOLD = 0.5

/** Classifications decided by rules before Jev's keep answer is consulted. */
export const RULE_CLASSIFICATIONS: ReadonlySet<string> = new Set([
  "keep-label",
  "archive-reversal",
  "calendar-reply",
  "calendar-invitation",
  "auto-reply",
  "marketing",
  "correspondent",
])

// Signals that Herb knows the sender of a personal message.
const CORRESPONDENT_SIGNALS = [
  "priorReply",
  "activeConversation",
  "herbInitiated",
] as const satisfies readonly (keyof ArchiveProtections)[]

// Signals of a relationship with the sender that block unsubscribing.
const UNSUBSCRIBE_PROTECTIONS = [
  "priorReply",
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
  /** Whether Herb keeps it in his inbox. */
  keep_in_inbox: JevNoulAnswer
  /** Why Herb keeps it. */
  attention_reason: JevChoiceAnswer
  /** Whether it is only a routine code or sign-in link; used to redact codes from logs. */
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
  /** METHOD of an attached iCalendar invitation (REQUEST, REPLY, CANCEL…), or null. */
  calendarMethod: string | null
  /** Whether the message is an automatic reply, from its Auto-Submitted header. */
  autoReply: boolean
  /** Whether the message has Herb's Keep label, set by his Gmail filters or by hand. */
  keepLabeled: boolean
  /** Deterministic protections computed by the supervisor. */
  archiveProtections: ArchiveProtections
}

/** Actions the supervisor would take for one message. */
export type JevDecision = {
  /** Most likely mail kind. */
  mailKind: MailKind
  /** Label action. "none" keeps a message where it is. */
  decision: "archive" | "promote" | "none"
  /** Why, for the decision log: a mail kind or rule when archiving, a reason when keeping. */
  classification: string
  /** Whether to send a one-click unsubscribe, and what blocked it otherwise. */
  unsubscribe: { eligible: boolean; blockedBy: string[] }
}
