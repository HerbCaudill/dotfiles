import { EMAIL_PROCESSING_ACCOUNT } from "./constants.ts"
import { sanitizeDecisionLogEntry } from "./sanitizeDecisionLogEntry.ts"
import type { ClassifierCandidate, NormalizedMailbox, NormalizedThreadMessage } from "./types.ts"
import type {
  DecisionLogEntry,
  EmailProcessingState,
  GmailMessage,
  GmailSupervisorDependencies,
  GmailSupervisorResult,
  GmailThread,
} from "./supervisorTypes.ts"
import { ExpiredGmailHistoryError } from "./supervisorTypes.ts"
import { validateClassifications } from "./validateClassifications.ts"

/** Process one mailbox synchronization window through the supervised classifier. */
export async function runGmailSupervisor(
  /** External boundaries and durable storage for the run. */
  dependencies: GmailSupervisorDependencies,
): Promise<GmailSupervisorResult> {
  const now = dependencies.now()
  const timestamp = now.toISOString()
  const [state, priorDecisions, profile] = await Promise.all([
    dependencies.loadState(),
    dependencies.loadDecisionLog(),
    dependencies.gmail.getProfile(),
  ])
  const { discovered, labelChanges } = await discoverWork(now, state, dependencies)
  const result = emptyResult()
  const archiveReversalSenders = new Set(state.archiveReversalSenders)
  const correctedMessageIds = await recordCorrections(
    timestamp,
    labelChanges,
    priorDecisions,
    archiveReversalSenders,
    dependencies,
  )
  result.corrected = correctedMessageIds.size
  const processedMessageIds = new Set(priorDecisions.map(entry => entry.messageId))
  const candidateIds = unique([
    ...discovered.map(message => message.messageId),
    ...state.retryMessageIds,
  ]).filter(
    messageId =>
      !correctedMessageIds.has(messageId) &&
      (!processedMessageIds.has(messageId) || state.retryMessageIds.includes(messageId)),
  )
  const candidates: ClassifierCandidate[] = []
  const messagesById = new Map<string, GmailMessage>()
  const threadsById = new Map<string, GmailThread>()
  const retryMessageIds = new Set(state.retryMessageIds)
  const retryOriginalLabels = getRetryOriginalLabels(priorDecisions, retryMessageIds)

  for (const messageId of candidateIds) {
    try {
      const message = await dependencies.gmail.getMessage(messageId)
      if (!isProcessable(message, retryMessageIds.has(messageId))) continue
      const thread = await dependencies.gmail.getThread(message.threadId)
      const candidate = await normalizeCandidate(
        message,
        thread,
        { ...state, archiveReversalSenders: [...archiveReversalSenders] },
        dependencies,
        retryOriginalLabels.get(messageId),
      )
      candidates.push(candidate)
      messagesById.set(
        messageId,
        retryOriginalLabels.has(messageId)
          ? { ...message, labelIds: retryOriginalLabels.get(messageId) }
          : message,
      )
      threadsById.set(messageId, thread)
    } catch {
      retryMessageIds.add(messageId)
      await dependencies.appendDecision(
        sanitizeDecisionLogEntry(
          createErrorLogEntry(timestamp, messageId, "", "Candidate inspection failed"),
        ),
      )
    }
  }

  if (candidates.length > 0) {
    let decisions: ReturnType<typeof validateClassifications> = []
    try {
      const output = await dependencies.classify({
        account: EMAIL_PROCESSING_ACCOUNT,
        candidates,
      })
      decisions = validateClassifications({ account: EMAIL_PROCESSING_ACCOUNT, candidates }, output)
    } catch {
      for (const candidate of candidates) {
        retryMessageIds.add(candidate.messageId)
        const message = messagesById.get(candidate.messageId)!
        await dependencies.appendDecision(
          sanitizeDecisionLogEntry(
            createErrorLogEntry(
              timestamp,
              candidate.messageId,
              candidate.threadId,
              "Classifier failed",
              message,
              candidate,
            ),
          ),
        )
      }
    }

    for (const decision of decisions) {
      const message = messagesById.get(decision.messageId)!
      const thread = threadsById.get(decision.messageId)!
      if (decision.mutation) {
        try {
          if (!threadHasMutation(thread, decision.mutation)) {
            await dependencies.gmail.modifyThreadLabels(decision.threadId, decision.mutation)
          }
          const verifiedThread = await dependencies.gmail.getThread(decision.threadId)
          if (!threadHasMutation(verifiedThread, decision.mutation)) {
            throw new Error("Gmail label verification failed")
          }
        } catch {
          retryMessageIds.add(decision.messageId)
          await dependencies.appendDecision(
            sanitizeDecisionLogEntry(
              toErrorLogEntry(timestamp, message, candidates, decision, "Gmail mutation failed"),
            ),
          )
          continue
        }
      }

      await dependencies.appendDecision(
        sanitizeDecisionLogEntry(toDecisionLogEntry(timestamp, message, candidates, decision)),
      )
      retryMessageIds.delete(decision.messageId)
      if (decision.decision === "archive") result.archived += 1
      if (decision.decision === "promote") result.promoted += 1
      if (decision.decision === "none") result.unchanged += 1
    }
  }

  const nextState: EmailProcessingState = {
    lastHistoryId: profile.historyId,
    lastCompletedAt: timestamp,
    retryMessageIds: [...retryMessageIds],
    archiveReversalSenders: [...archiveReversalSenders].sort(),
  }
  await dependencies.saveState(nextState)
  result.retried = retryMessageIds.size
  return result
}

/** Discover new messages and label changes, with an expired-history fallback. */
async function discoverWork(
  /** Run timestamp. */
  now: Date,
  /** Durable synchronization state. */
  state: EmailProcessingState,
  /** Supervisor dependencies. */
  dependencies: GmailSupervisorDependencies,
): Promise<{
  /** Discovered message references. */
  discovered: Awaited<ReturnType<GmailSupervisorDependencies["gmail"]["listRecentInboxMessages"]>>
  /** Incremental label changes. */
  labelChanges: Awaited<
    ReturnType<GmailSupervisorDependencies["gmail"]["listHistory"]>
  >["labelChanges"]
}> {
  if (!state.lastHistoryId) {
    return {
      discovered: await dependencies.gmail.listRecentInboxMessages(daysBefore(now, 7)),
      labelChanges: [],
    }
  }

  try {
    const history = await dependencies.gmail.listHistory(state.lastHistoryId)
    return { discovered: history.addedMessages, labelChanges: history.labelChanges }
  } catch (error) {
    if (!(error instanceof ExpiredGmailHistoryError)) throw error
    return {
      discovered: await dependencies.gmail.listRecentInboxMessages(daysBefore(now, 7)),
      labelChanges: [],
    }
  }
}

/** Record manual label corrections and update permanent archive protections. */
async function recordCorrections(
  /** Run timestamp. */
  timestamp: string,
  /** Incremental Gmail label changes. */
  labelChanges: Awaited<
    ReturnType<GmailSupervisorDependencies["gmail"]["listHistory"]>
  >["labelChanges"],
  /** Prior sanitized decisions. */
  priorDecisions: DecisionLogEntry[],
  /** Mutable run-local archive reversal set. */
  archiveReversalSenders: Set<string>,
  /** Supervisor dependencies. */
  dependencies: GmailSupervisorDependencies,
): Promise<Set<string>> {
  const latestByMessageId = new Map<string, DecisionLogEntry>()
  for (const entry of priorDecisions) latestByMessageId.set(entry.messageId, entry)
  const recorded = new Set<string>()

  for (const change of labelChanges) {
    if (recorded.has(change.messageId)) continue
    const prior = latestByMessageId.get(change.messageId)
    if (!prior) continue
    const classification = getCorrectionClassification(prior, change)
    if (!classification) continue

    if (classification === "archive-reversed") {
      const senderAddress = extractLoggedAddress(prior.sender)
      if (senderAddress) archiveReversalSenders.add(senderAddress)
    }
    await dependencies.appendDecision(
      sanitizeDecisionLogEntry({
        ...prior,
        timestamp,
        decision: "correction",
        classification,
        confidence: "high",
        reason: correctionReason(classification),
        policySignals: [classification],
      }),
    )
    recorded.add(change.messageId)
  }

  return recorded
}

/** Recognize one supported manual correction from exact label deltas. */
function getCorrectionClassification(
  /** Latest prior decision for the message. */
  prior: DecisionLogEntry,
  /** New Gmail label transition. */
  change: Awaited<
    ReturnType<GmailSupervisorDependencies["gmail"]["listHistory"]>
  >["labelChanges"][number],
): "archive-reversed" | "promotion-reversed" | "promotion-missed" | null {
  if (
    (prior.decision === "archive" || prior.classification === "archive-error") &&
    change.addedLabelIds.includes("INBOX")
  ) {
    return "archive-reversed"
  }
  if (
    (prior.decision === "promote" || prior.classification === "promote-error") &&
    (change.removedLabelIds.includes("CATEGORY_PERSONAL") ||
      change.addedLabelIds.some(label => NON_PRIMARY_CATEGORY_LABELS.has(label)))
  ) {
    return "promotion-reversed"
  }
  if (
    prior.decision === "none" &&
    prior.originalLabels.some(label => NON_PRIMARY_CATEGORY_LABELS.has(label)) &&
    (change.addedLabelIds.includes("CATEGORY_PERSONAL") || change.addedLabelIds.includes("STARRED"))
  ) {
    return "promotion-missed"
  }
  return null
}

/** Return a stable explanation for one recognized correction. */
function correctionReason(
  /** Stable correction category. */
  classification: "archive-reversed" | "promotion-reversed" | "promotion-missed",
): string {
  if (classification === "archive-reversed") return "Herb returned the thread to Inbox."
  if (classification === "promotion-reversed") return "Herb moved the thread out of Primary."
  return "Herb promoted or starred a previously untouched message."
}

/** Normalize one processable Gmail message and its meaningful thread context. */
async function normalizeCandidate(
  /** Target message. */
  message: GmailMessage,
  /** Complete Gmail thread. */
  thread: GmailThread,
  /** Durable supervisor protections. */
  state: EmailProcessingState,
  /** External boundaries used for deterministic facts. */
  dependencies: GmailSupervisorDependencies,
  /** Original category labels recovered for an idempotent retry. */
  originalLabelIds?: string[],
): Promise<ClassifierCandidate> {
  const sender = parseMailbox(getHeader(message, "From"))
  const recipients = parseMailboxes([
    getHeader(message, "To"),
    getHeader(message, "Cc"),
    getHeader(message, "Bcc"),
  ])
  const priorReply = await dependencies.gmail.hasPriorReplyTo(sender.address)
  const normalizedThread = thread.messages
    .filter(threadMessage => threadMessage.id !== message.id)
    .map(toNormalizedThreadMessage)
  const herbMessages = normalizedThread.filter(
    threadMessage => threadMessage.sender.address === EMAIL_PROCESSING_ACCOUNT,
  )
  const subject = getHeader(message, "Subject")
  const body = getMeaningfulBody(message)

  return {
    messageId: message.id,
    threadId: message.threadId,
    sender,
    recipients,
    subject,
    body,
    thread: normalizedThread,
    category: getCategory(originalLabelIds ?? message.labelIds ?? []),
    archiveProtections: {
      devResultsSender: sender.address.endsWith("@devresults.com"),
      priorReply,
      archiveReversal: state.archiveReversalSenders.includes(sender.address),
      protectedCorrespondent: false,
      activeConversation: herbMessages.length > 0,
      requestedWork: herbMessages.some(message => herbRequestedWork(message.body)),
      herbInitiated: normalizedThread[0]?.sender.address === EMAIL_PROCESSING_ACCOUNT,
    },
    delegatedCustomer: {
      customerInquiry: isCustomerInquiry(subject, body),
      otherDevResultsRecipient: recipients.some(
        recipient =>
          recipient.address !== EMAIL_PROCESSING_ACCOUNT &&
          recipient.address.endsWith("@devresults.com"),
      ),
      requiresHerbAction: requiresHerbAction(subject, body),
    },
  }
}

/** Recover original labels from the latest logged failure for each retry. */
function getRetryOriginalLabels(
  /** Prior sanitized decisions in append order. */
  priorDecisions: DecisionLogEntry[],
  /** Message IDs in durable retry state. */
  retryMessageIds: Set<string>,
): Map<string, string[]> {
  const labelsByMessageId = new Map<string, string[]>()
  for (const entry of priorDecisions) {
    if (
      retryMessageIds.has(entry.messageId) &&
      entry.decision === "error" &&
      entry.originalLabels.length > 0
    ) {
      labelsByMessageId.set(entry.messageId, [...entry.originalLabels])
    }
  }
  return labelsByMessageId
}

/** Identify an explicit request Herb made in earlier thread context. */
function herbRequestedWork(
  /** Meaningful body from Herb's prior message. */
  body: string,
): boolean {
  return /\b(?:please|can you|could you|would you)\b/i.test(body)
}

/** Conservatively identify an explicit customer, demo, or procurement inquiry. */
function isCustomerInquiry(
  /** Message subject. */
  subject: string,
  /** Complete meaningful body. */
  body: string,
): boolean {
  return /\b(?:demo|procurement|request for proposal|rfp|pricing|purchase|evaluate|evaluation|trial)\b/i.test(
    `${subject}\n${body}`,
  )
}

/** Conservatively identify text that explicitly requires Herb to act. */
function requiresHerbAction(
  /** Message subject. */
  subject: string,
  /** Complete meaningful body. */
  body: string,
): boolean {
  const text = `${subject}\n${body}`
  return (
    /\b(?:Herb|you)[,:]?\s+(?:please\s+)?(?:reply|respond|approve|decide|confirm|attend|review|send|choose|schedule)\b/i.test(
      text,
    ) ||
    /\b(?:action required|your approval|your decision|please (?:reply|respond|approve|confirm|review))\b/i.test(
      text,
    )
  )
}

/** Convert a prior Gmail message into inert classifier context. */
function toNormalizedThreadMessage(
  /** Prior Gmail message. */
  message: GmailMessage,
): NormalizedThreadMessage {
  return {
    sender: parseMailbox(getHeader(message, "From")),
    recipients: parseMailboxes([getHeader(message, "To"), getHeader(message, "Cc")]),
    subject: getHeader(message, "Subject"),
    body: getMeaningfulBody(message),
  }
}

/** Build a sanitized decision record without including message content. */
function toDecisionLogEntry(
  /** Run timestamp. */
  timestamp: string,
  /** Original Gmail message. */
  message: GmailMessage,
  /** Offered candidates. */
  candidates: ClassifierCandidate[],
  /** Validated decision. */
  decision: ReturnType<typeof validateClassifications>[number],
): DecisionLogEntry {
  const candidate = candidates.find(item => item.messageId === decision.messageId)!
  return {
    timestamp,
    messageId: decision.messageId,
    threadId: decision.threadId,
    sender: formatMailbox(candidate.sender),
    subject: candidate.subject,
    originalLabels: [...(message.labelIds ?? [])],
    decision: decision.decision,
    classification: decision.classification,
    confidence: decision.confidence,
    reason: decision.reason,
    policySignals: [...decision.policySignals],
    gmailUrl: `https://mail.google.com/mail/#all/${encodeURIComponent(decision.threadId)}`,
  }
}

/** Build a sanitized error record from an inspected candidate. */
function toErrorLogEntry(
  /** Run timestamp. */
  timestamp: string,
  /** Original Gmail message. */
  message: GmailMessage,
  /** Offered candidates. */
  candidates: ClassifierCandidate[],
  /** Decision whose action failed. */
  decision: ReturnType<typeof validateClassifications>[number],
  /** Stable error reason with no external response content. */
  reason: string,
): DecisionLogEntry {
  const candidate = candidates.find(item => item.messageId === decision.messageId)!
  return {
    ...createErrorLogEntry(
      timestamp,
      decision.messageId,
      decision.threadId,
      reason,
      message,
      candidate,
    ),
    classification: `${decision.decision}-error`,
    policySignals: [...decision.policySignals, "retry"],
  }
}

/** Build a sanitized error log with no raw exception text. */
function createErrorLogEntry(
  /** Run timestamp. */
  timestamp: string,
  /** Gmail message ID. */
  messageId: string,
  /** Gmail thread ID, when known. */
  threadId: string,
  /** Stable supervisor-owned reason. */
  reason: string,
  /** Inspected Gmail message, when available. */
  message?: GmailMessage,
  /** Normalized candidate, when available. */
  candidate?: ClassifierCandidate,
): DecisionLogEntry {
  return {
    timestamp,
    messageId,
    threadId,
    sender: candidate ? formatMailbox(candidate.sender) : "",
    subject: candidate?.subject ?? "",
    originalLabels: [...(message?.labelIds ?? [])],
    decision: "error",
    classification: "processing-error",
    confidence: "low",
    reason,
    policySignals: ["retry"],
    gmailUrl: threadId ? `https://mail.google.com/mail/#all/${encodeURIComponent(threadId)}` : "",
  }
}

/** Check that every message in a thread reflects an exact authorized delta. */
function threadHasMutation(
  /** Current Gmail thread. */
  thread: GmailThread,
  /** Validated intended label delta. */
  mutation: NonNullable<ReturnType<typeof validateClassifications>[number]["mutation"]>,
): boolean {
  return (
    thread.messages.length > 0 &&
    thread.messages.every(message => {
      const labels = new Set(message.labelIds ?? [])
      return (
        mutation.addLabelIds.every(label => labels.has(label)) &&
        mutation.removeLabelIds.every(label => !labels.has(label))
      )
    })
  )
}

/** Check whether a discovered message remains safe and eligible to inspect. */
function isProcessable(
  /** Current Gmail message. */
  message: GmailMessage,
  /** Whether durable state requires another attempt regardless of Inbox state. */
  isRetry: boolean,
): boolean {
  const labels = new Set(message.labelIds ?? [])
  return (isRetry || labels.has("INBOX")) && !labels.has("SPAM") && !labels.has("TRASH")
}

/** Read one case-insensitive Gmail header. */
function getHeader(
  /** Gmail message. */
  message: GmailMessage,
  /** Header name. */
  name: string,
): string {
  return (
    message.payload?.headers?.find(header => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  )
}

/** Extract inline meaningful text while ignoring attachments. */
function getMeaningfulBody(
  /** Gmail message. */
  message: GmailMessage,
): string {
  return extractPartText(message.payload)
}

/** Decode one inline MIME tree, preferring plain text over HTML. */
function extractPartText(
  /** Current MIME part. */
  part: GmailMessage["payload"],
): string {
  if (!part || part.filename || part.body?.attachmentId) return ""
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBody(part.body.data)

  const plainText = part.parts
    ?.filter(child => child.mimeType === "text/plain")
    .map(extractPartText)
    .filter(Boolean)
    .join("\n")
  if (plainText) return plainText

  const nestedText = part.parts?.map(extractPartText).filter(Boolean).join("\n")
  if (nestedText) return nestedText
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBody(part.body.data)
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }
  return ""
}

/** Decode Gmail base64url text. */
function decodeBody(
  /** Base64url-encoded content. */
  data: string,
): string {
  return Buffer.from(data, "base64url").toString("utf8").replace(/\r\n/g, "\n").trim()
}

/** Parse one RFC-like mailbox without executing or resolving its contents. */
function parseMailbox(
  /** Raw header fragment. */
  value: string,
): NormalizedMailbox {
  const angleMatch = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  if (angleMatch) {
    return {
      name: angleMatch[1].replace(/^"|"$/g, "").trim(),
      address: angleMatch[2].trim().toLowerCase(),
    }
  }
  return { name: "", address: value.trim().toLowerCase() }
}

/** Parse comma-separated mailbox headers. */
function parseMailboxes(
  /** Raw recipient headers. */
  values: string[],
): NormalizedMailbox[] {
  return values
    .flatMap(value => value.split(","))
    .map(parseMailbox)
    .filter(mailbox => mailbox.address.length > 0)
}

/** Format a normalized mailbox for the audit log. */
function formatMailbox(
  /** Normalized mailbox. */
  mailbox: NormalizedMailbox,
): string {
  return mailbox.name ? `${mailbox.name} <${mailbox.address}>` : mailbox.address
}

/** Map Gmail system labels to the classifier's stable category. */
function getCategory(
  /** Current message label IDs. */
  labelIds: string[],
): ClassifierCandidate["category"] {
  if (labelIds.includes("CATEGORY_UPDATES")) return "updates"
  if (labelIds.includes("CATEGORY_PROMOTIONS")) return "promotions"
  if (labelIds.includes("CATEGORY_SOCIAL")) return "social"
  if (labelIds.includes("CATEGORY_FORUMS")) return "forums"
  return "primary"
}

/** Return a new date a fixed number of UTC days before a timestamp. */
function daysBefore(
  /** Source timestamp. */
  value: Date,
  /** Whole days to subtract. */
  days: number,
): Date {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1_000)
}

/** Deduplicate strings without changing first-seen order. */
function unique(
  /** Values to deduplicate. */
  values: string[],
): string[] {
  return [...new Set(values)]
}

/** Extract an exact lowercase address from a previously formatted sender. */
function extractLoggedAddress(
  /** Sanitized sender string. */
  sender: string,
): string {
  const angleMatch = sender.match(/<([^<>]+)>\s*$/)
  return (angleMatch?.[1] ?? sender).trim().toLowerCase()
}

/** Create zeroed public result counts. */
function emptyResult(): GmailSupervisorResult {
  return { archived: 0, promoted: 0, unchanged: 0, retried: 0, corrected: 0 }
}

/** Gmail labels that place a message outside Primary. */
const NON_PRIMARY_CATEGORY_LABELS = new Set([
  "CATEGORY_UPDATES",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
])
