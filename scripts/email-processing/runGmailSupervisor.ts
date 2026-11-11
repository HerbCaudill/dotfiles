import { inspect } from "node:util"

import { POLICY_VERSION, type JevClassification } from "./classifyWithJev.ts"
import {
  ARCHIVE_LABEL_MUTATION,
  EMAIL_PROCESSING_ACCOUNT,
  KEEP_LABEL_NAME,
  MAX_ACTIONS_PER_RUN,
  PROMOTE_LABEL_MUTATION,
} from "./constants.ts"
import {
  decideFromJevAnswers,
  MARKETING_THRESHOLD,
  type JevDecision,
} from "./decideFromJevAnswers.ts"
import { sanitizeDecisionLogEntry } from "./sanitizeDecisionLogEntry.ts"
import type {
  BulkMailFacts,
  ClassifierCandidate,
  LabelMutation,
  NormalizedMailbox,
  NormalizedThreadMessage,
} from "./types.ts"
import type {
  DecisionLogEntry,
  EmailProcessingState,
  GmailClient,
  GmailHistory,
  GmailMessage,
  GmailMessagePart,
  GmailSupervisorDependencies,
  GmailSupervisorResult,
  GmailThread,
} from "./supervisorTypes.ts"
import { ExpiredGmailHistoryError } from "./supervisorTypes.ts"

/** Process one mailbox synchronization window with Jev and the tuned email rules. */
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
  const result = emptyResult()
  const archiveReversalSenders = getArchiveReversalSenders(state, priorDecisions)
  if (!state.lastHistoryId) {
    await dependencies.saveState(
      createStateSnapshot(
        profile.historyId,
        timestamp,
        new Set(),
        archiveReversalSenders,
        new Map(),
      ),
    )
    return result
  }

  const { discovered, labelChanges } = await discoverWork(state, dependencies)
  const correctedMessageIds = await recordCorrections(
    timestamp,
    labelChanges,
    priorDecisions,
    archiveReversalSenders,
    dependencies,
  )
  result.corrected = correctedMessageIds.size
  const completedMessageIds = getCompletedMessageIds(priorDecisions)
  const supersededRetryMessageIds = getSupersededRetryMessageIds(priorDecisions)
  const retryMessageIds = new Set([
    ...state.retryMessageIds.filter(
      messageId => !completedMessageIds.has(messageId) && !supersededRetryMessageIds.has(messageId),
    ),
    ...getLoggedRetryMessageIds(priorDecisions, state.lastCompletedAt).filter(
      messageId => !supersededRetryMessageIds.has(messageId),
    ),
  ])
  const candidateIds = unique([
    ...discovered.map(message => message.messageId),
    ...retryMessageIds,
  ]).filter(messageId => !correctedMessageIds.has(messageId) && !completedMessageIds.has(messageId))
  const pendingMessageIds = new Set(candidateIds.slice(MAX_ACTIONS_PER_RUN))
  pendingMessageIds.forEach(messageId => retryMessageIds.add(messageId))
  const selectedCandidateIds = candidateIds.slice(0, MAX_ACTIONS_PER_RUN)
  const retryOriginalLabels = getRetryOriginalLabels(state, priorDecisions, retryMessageIds)
  const inboxMutationRetryMessageIds = new Set(
    [...retryOriginalLabels]
      .filter(([, labelIds]) => labelIds.includes("INBOX"))
      .map(([messageId]) => messageId),
  )
  const candidateIdSet = new Set(candidateIds)
  const plannedThreadIds = new Set<string>()
  const keepLabelId =
    selectedCandidateIds.length > 0
      ? await dependencies.gmail.getLabelIdByName(KEEP_LABEL_NAME)
      : null

  /** Save state mid-run without advancing the history checkpoint. */
  const saveRetryCheckpoint = () =>
    dependencies.saveState(
      createStateSnapshot(
        state.lastHistoryId,
        state.lastCompletedAt,
        retryMessageIds,
        archiveReversalSenders,
        retryOriginalLabels,
      ),
    )

  /** Log one failure and keep the message for another attempt. */
  const recordFailure = async (entry: DecisionLogEntry) => {
    retryMessageIds.add(entry.messageId)
    await dependencies.appendDecision(sanitizeDecisionLogEntry(entry))
  }

  for (const messageId of selectedCandidateIds) {
    let inspectedMessageId = messageId
    let candidate: ClassifierCandidate
    let message: GmailMessage
    let thread: GmailThread
    let supersededRetries: string[]
    try {
      const discoveredMessage = await dependencies.gmail.getMessage(messageId)
      // Drafts that were sent or deleted, and deleted mail, show up in history and then vanish.
      if (!discoveredMessage) {
        pendingMessageIds.delete(messageId)
        retryMessageIds.delete(messageId)
        retryOriginalLabels.delete(messageId)
        continue
      }
      if (plannedThreadIds.has(discoveredMessage.threadId)) continue
      if (!isProcessable(discoveredMessage, inboxMutationRetryMessageIds.has(messageId))) {
        if (retryMessageIds.has(messageId)) {
          await dependencies.appendDecision(
            sanitizeDecisionLogEntry(createRetryNoActionLogEntry(timestamp, discoveredMessage)),
          )
          retryMessageIds.delete(messageId)
          retryOriginalLabels.delete(messageId)
          result.unchanged += 1
        }
        continue
      }
      thread = await dependencies.gmail.getThread(discoveredMessage.threadId)
      const targetMessage = findNewestThreadCandidate(
        thread,
        candidateIdSet,
        inboxMutationRetryMessageIds,
      )
      if (!targetMessage) continue
      inspectedMessageId = targetMessage.id
      pendingMessageIds.delete(targetMessage.id)
      plannedThreadIds.add(thread.id)
      const targetIndex = thread.messages.findIndex(item => item.id === targetMessage.id)
      supersededRetries = thread.messages
        .slice(0, targetIndex)
        .map(item => item.id)
        .filter(item => retryMessageIds.has(item))
      const originalLabelIds = retryOriginalLabels.get(targetMessage.id)
      message = originalLabelIds ? { ...targetMessage, labelIds: originalLabelIds } : targetMessage
      candidate = await normalizeCandidate(
        targetMessage,
        thread,
        { archiveReversalSenders, keepLabelId },
        dependencies.gmail,
        originalLabelIds,
      )
    } catch (error) {
      await recordFailure(
        createErrorLogEntry(
          timestamp,
          inspectedMessageId,
          "",
          "Candidate inspection failed",
          undefined,
          undefined,
          formatException(error),
        ),
      )
      continue
    }

    let plan: PlannedDecision
    try {
      plan = planDecision(
        candidate,
        await dependencies.classify({ candidate, evaluatedAt: timestamp }),
      )
    } catch (error) {
      await recordFailure(
        createErrorLogEntry(
          timestamp,
          candidate.messageId,
          candidate.threadId,
          "Classifier failed",
          message,
          candidate,
          formatException(error),
        ),
      )
      continue
    }

    if (plan.mutation && !dependencies.logOnly) {
      retryMessageIds.add(candidate.messageId)
      retryOriginalLabels.set(candidate.messageId, [...(message.labelIds ?? [])])
      await saveRetryCheckpoint()
      try {
        if (!threadHasMutation(thread, plan.mutation, candidate.messageId)) {
          await dependencies.gmail.modifyThreadLabels(candidate.threadId, plan.mutation)
        }
        const verifiedThread = await dependencies.gmail.getThread(candidate.threadId)
        if (!threadHasMutation(verifiedThread, plan.mutation, candidate.messageId)) {
          throw new Error("Gmail label verification failed")
        }
      } catch (error) {
        await recordFailure(
          toErrorLogEntry(
            timestamp,
            message,
            candidate,
            plan,
            "Gmail mutation failed",
            formatException(error),
          ),
        )
        continue
      }
    }

    const entry = sanitizeDecisionLogEntry(
      toDecisionLogEntry(timestamp, message, candidate, plan, dependencies.logOnly),
    )
    try {
      // Queue before logging: the queue is keyed by sender, so a retry after a failed log is harmless.
      if (plan.decision === "archive" && plan.unsubscribe.eligible) {
        await dependencies.queueUnsubscribe({
          address: candidate.sender.address,
          name: candidate.sender.name,
          sampleSubject: entry.subject,
          url: candidate.bulkMail.oneClickUnsubscribeUrl!,
          messageId: candidate.messageId,
          threadId: candidate.threadId,
          receivedAt: candidate.receivedAt,
        })
      }
      await dependencies.appendDecision(entry)
    } catch {
      retryMessageIds.add(candidate.messageId)
      if (plan.mutation && !dependencies.logOnly) {
        retryOriginalLabels.set(candidate.messageId, [...(message.labelIds ?? [])])
      } else {
        retryOriginalLabels.delete(candidate.messageId)
      }
      await saveRetryCheckpoint()
      continue
    }
    retryMessageIds.delete(candidate.messageId)
    retryOriginalLabels.delete(candidate.messageId)
    for (const supersededMessageId of supersededRetries) {
      retryMessageIds.delete(supersededMessageId)
      retryOriginalLabels.delete(supersededMessageId)
    }
    if (plan.decision === "archive") result.archived += 1
    if (plan.decision === "promote") result.promoted += 1
    if (plan.decision === "none") result.unchanged += 1
  }

  await dependencies.saveState(
    createStateSnapshot(
      profile.historyId,
      timestamp,
      retryMessageIds,
      archiveReversalSenders,
      retryOriginalLabels,
    ),
  )
  result.pending = [...pendingMessageIds].filter(messageId => retryMessageIds.has(messageId)).length
  result.retried = retryMessageIds.size - result.pending
  return result
}

/**
 * Turn Jev's answers into a decision, then apply the guards that stay in code whatever Jev says:
 * never archive mail from a devresults.com sender, and only ever use the two authorized label deltas.
 */
export function planDecision(
  /** Normalized message and its facts. */
  candidate: ClassifierCandidate,
  /** Jev's answers for the message. */
  jev: JevClassification,
): PlannedDecision {
  const decided = decideFromJevAnswers({
    answers: jev.answers,
    category: candidate.category,
    senderAddress: candidate.sender.address,
    listId: candidate.bulkMail.listId,
    oneClickUnsubscribe: candidate.bulkMail.oneClickUnsubscribeUrl !== null,
    calendarMethod: candidate.calendarMethod,
    autoReply: candidate.autoReply,
    keepLabeled: candidate.keepLabeled,
    archiveProtections: candidate.archiveProtections,
  })
  const guarded: JevDecision =
    decided.decision === "archive" && candidate.sender.address.endsWith("@devresults.com")
      ? {
          ...decided,
          decision: "none",
          classification: "devresults-sender",
          unsubscribe: { eligible: false, blockedBy: ["kept"] },
        }
      : decided
  const marketing = jev.answers.mail_kind.probabilities.marketing ?? 0
  const keep = jev.answers.keep_in_inbox.noul
  const ruleDecided = guarded.classification in RULE_REASONS
  return {
    ...guarded,
    mutation:
      guarded.decision === "archive"
        ? ARCHIVE_LABEL_MUTATION
        : guarded.decision === "promote"
          ? PROMOTE_LABEL_MUTATION
          : null,
    confidence: ruleDecided ? "high" : confidenceFor(keep),
    reason: ruleDecided
      ? RULE_REASONS[guarded.classification]!
      : `Jev: ${keep >= 0.5 ? "keep" : "archive"} (keep ${round(keep)}, ${kebab(guarded.mailKind)}).`,
    routineAuthentication: jev.answers.routine_authentication.noul >= 0.5,
    jev: {
      model: jev.model,
      mailKind: kebab(guarded.mailKind),
      marketing: round(marketing),
      keep: round(keep),
    },
  }
}

/** Map the distance of Jev's keep probability from the 0.5 threshold to a qualitative certainty. */
function confidenceFor(
  /** Probability that Herb keeps the message. */
  keep: number,
): DecisionLogEntry["confidence"] {
  const distance = Math.abs(keep - 0.5)
  if (distance >= 0.35) return "high"
  if (distance >= 0.15) return "medium"
  return "low"
}

/** Return message IDs whose latest durable record requires another attempt. */
function getLoggedRetryMessageIds(
  /** Prior sanitized decisions in append order. */
  priorDecisions: DecisionLogEntry[],
  /** Last state checkpoint that already accounted for earlier errors. */
  lastCompletedAt: string | null,
): string[] {
  const latestByMessageId = new Map<string, DecisionLogEntry>()
  for (const entry of priorDecisions) latestByMessageId.set(entry.messageId, entry)
  return [...latestByMessageId.values()]
    .filter(
      entry =>
        entry.decision === "error" && (!lastCompletedAt || entry.timestamp > lastCompletedAt),
    )
    .map(entry => entry.messageId)
}

/** Return retry errors superseded by a later completed outcome in the same thread. */
function getSupersededRetryMessageIds(
  /** Prior sanitized decisions in append order. */
  priorDecisions: DecisionLogEntry[],
): Set<string> {
  const latestCompletedIndexByThreadId = new Map<string, number>()
  priorDecisions.forEach((entry, index) => {
    if (entry.decision !== "error") latestCompletedIndexByThreadId.set(entry.threadId, index)
  })
  return new Set(
    priorDecisions.flatMap((entry, index) =>
      entry.decision === "error" &&
      (latestCompletedIndexByThreadId.get(entry.threadId) ?? -1) > index
        ? [entry.messageId]
        : [],
    ),
  )
}

/** Return message IDs whose latest durable log entry represents completed processing. */
function getCompletedMessageIds(
  /** Prior sanitized decisions in append order. */
  priorDecisions: DecisionLogEntry[],
): Set<string> {
  const latestByMessageId = new Map<string, DecisionLogEntry>()
  for (const entry of priorDecisions) latestByMessageId.set(entry.messageId, entry)
  return new Set(
    [...latestByMessageId.values()]
      .filter(entry => entry.decision !== "error")
      .map(entry => entry.messageId),
  )
}

/** Select the newest eligible candidate represented in one Gmail thread. */
function findNewestThreadCandidate(
  /** Complete Gmail thread in API chronology. */
  thread: GmailThread,
  /** Message IDs eligible for this run. */
  candidateMessageIds: Set<string>,
  /** Mutation retries whose original message was in Inbox. */
  inboxMutationRetryMessageIds: Set<string>,
): GmailMessage | undefined {
  return [...thread.messages]
    .reverse()
    .find(
      message =>
        candidateMessageIds.has(message.id) &&
        isProcessable(message, inboxMutationRetryMessageIds.has(message.id)),
    )
}

/** Discover new messages and label changes after the durable Gmail checkpoint. */
async function discoverWork(
  /** Durable synchronization state. */
  state: EmailProcessingState,
  /** Supervisor dependencies. */
  dependencies: GmailSupervisorDependencies,
): Promise<{
  /** Discovered message references. */
  discovered: GmailHistory["addedMessages"]
  /** Incremental label changes. */
  labelChanges: GmailHistory["labelChanges"]
}> {
  try {
    const history = await dependencies.gmail.listHistory(state.lastHistoryId!)
    return { discovered: history.addedMessages, labelChanges: history.labelChanges }
  } catch (error) {
    if (!(error instanceof ExpiredGmailHistoryError)) throw error
    return { discovered: [], labelChanges: [] }
  }
}

/** Record manual label corrections and update permanent archive protections. */
async function recordCorrections(
  /** Run timestamp. */
  timestamp: string,
  /** Incremental Gmail label changes. */
  labelChanges: GmailHistory["labelChanges"],
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
    const { logOnly: _logOnly, jev: _jev, unsubscribe: _unsubscribe, ...priorFields } = prior
    const correction = sanitizeDecisionLogEntry({
      ...priorFields,
      timestamp,
      decision: "correction",
      classification,
      confidence: "high",
      reason: correctionReason(classification),
      policySignals: [classification],
      priorClassification: prior.classification,
      priorReason: prior.reason,
      priorPolicySignals: [...prior.policySignals],
    })
    await dependencies.appendDecision(correction)
    priorDecisions.push(correction)
    recorded.add(change.messageId)
  }

  return recorded
}

/** Recognize one supported manual correction from exact label deltas. */
function getCorrectionClassification(
  /** Latest prior decision for the message. */
  prior: DecisionLogEntry,
  /** New Gmail label transition. */
  change: GmailHistory["labelChanges"][number],
): "archive-reversed" | "promotion-reversed" | "promotion-missed" | null {
  // In log-only mode the job changed nothing, so there is nothing for Herb to reverse.
  if (
    !prior.logOnly &&
    (prior.decision === "archive" || prior.classification === "archive-error") &&
    change.addedLabelIds.includes("INBOX")
  ) {
    return "archive-reversed"
  }
  if (
    !prior.logOnly &&
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

/** Normalize one processable Gmail message, its thread context and the facts the rules need. */
export async function normalizeCandidate(
  /** Target message. */
  message: GmailMessage,
  /** Complete Gmail thread. */
  thread: GmailThread,
  /** Run-wide facts. */
  context: {
    /** Exact senders whose archive Herb has undone. */
    archiveReversalSenders: ReadonlySet<string>
    /** ID of Herb's Keep label, or null when he has none. */
    keepLabelId: string | null
  },
  /** Gmail reads used for relationship and calendar facts. */
  gmail: Pick<GmailClient, "hasPriorReplyTo" | "getAttachmentData">,
  /** Original labels recovered for an idempotent retry. */
  originalLabelIds?: string[],
): Promise<ClassifierCandidate> {
  const sender = parseMailbox(getHeader(message, "From"))
  const recipients = parseMailboxes([
    getHeader(message, "To"),
    getHeader(message, "Cc"),
    getHeader(message, "Bcc"),
  ])
  const priorReply = await gmail.hasPriorReplyTo(sender.address)
  const normalizedThread = thread.messages
    .filter(threadMessage => threadMessage.id !== message.id)
    .map(toNormalizedThreadMessage)
  const herbMessages = normalizedThread.filter(
    threadMessage => threadMessage.sender.address === EMAIL_PROCESSING_ACCOUNT,
  )
  const labelIds = originalLabelIds ?? message.labelIds ?? []

  return {
    messageId: message.id,
    threadId: message.threadId,
    receivedAt: toReceivedAt(message),
    sender,
    recipients,
    subject: getHeader(message, "Subject"),
    body: getMeaningfulBody(message),
    thread: normalizedThread,
    category: getCategory(labelIds),
    archiveProtections: {
      priorReply,
      archiveReversal: context.archiveReversalSenders.has(sender.address),
      activeConversation: herbMessages.length > 0,
      requestedWork: herbMessages.some(herbMessage => herbRequestedWork(herbMessage.body)),
      herbInitiated: normalizedThread[0]?.sender.address === EMAIL_PROCESSING_ACCOUNT,
    },
    bulkMail: readBulkMailFacts(message),
    calendarMethod: await readCalendarMethod(message, gmail),
    autoReply:
      /auto-replied/i.test(getHeader(message, "Auto-Submitted")) ||
      getHeader(message, "X-Autoreply") !== "" ||
      getHeader(message, "X-Autorespond") !== "",
    keepLabeled: context.keepLabelId !== null && labelIds.includes(context.keepLabelId),
  }
}

/** Read List-Id and the RFC 8058 one-click unsubscribe URL, which needs both headers. */
function readBulkMailFacts(
  /** Gmail message. */
  message: GmailMessage,
): BulkMailFacts {
  const listUnsubscribe = getHeader(message, "List-Unsubscribe")
  const oneClick = /List-Unsubscribe=One-Click/i.test(getHeader(message, "List-Unsubscribe-Post"))
  const url = listUnsubscribe.match(/<(https:\/\/[^>]+)>/)?.[1] ?? null
  return {
    listId: getHeader(message, "List-Id"),
    listUnsubscribe: listUnsubscribe.length > 0,
    oneClickUnsubscribeUrl: oneClick ? url : null,
  }
}

/** Read the METHOD of an attached iCalendar invitation, such as REQUEST or REPLY, or null without one. */
async function readCalendarMethod(
  /** Full-format message. */
  message: GmailMessage,
  /** Gmail attachment reader. */
  gmail: Pick<GmailClient, "getAttachmentData">,
): Promise<string | null> {
  const part = findPart(message.payload, candidate => candidate.mimeType === "text/calendar")
  if (!part) return null
  const attachmentId = part.body?.attachmentId
  const data =
    part.body?.data ??
    (attachmentId ? await gmail.getAttachmentData(message.id, attachmentId) : undefined)
  if (!data) return null
  const text = Buffer.from(data, "base64url").toString("utf8")
  return text.match(/^METHOD:\s*(\S+)/m)?.[1]?.toUpperCase() ?? null
}

/** Find the first MIME part matching a test, depth first. */
function findPart(
  /** Part to search. */
  part: GmailMessagePart | undefined,
  /** Test for the wanted part. */
  test: (part: GmailMessagePart) => boolean,
): GmailMessagePart | undefined {
  if (!part) return undefined
  if (test(part)) return part
  for (const child of part.parts ?? []) {
    const found = findPart(child, test)
    if (found) return found
  }
  return undefined
}

/** Rebuild permanent exact-sender archive reversals from both state and durable corrections. */
function getArchiveReversalSenders(
  /** Last successfully persisted state. */
  state: EmailProcessingState,
  /** Durable sanitized decision log. */
  priorDecisions: DecisionLogEntry[],
): Set<string> {
  return new Set([
    ...state.archiveReversalSenders,
    ...priorDecisions
      .filter(
        entry => entry.decision === "correction" && entry.classification === "archive-reversed",
      )
      .map(entry => extractLoggedAddress(entry.sender))
      .filter(Boolean),
  ])
}

/** Recover original labels from the latest logged failure for each retry. */
function getRetryOriginalLabels(
  /** Durable state, including write-ahead retry labels when present. */
  state: EmailProcessingState,
  /** Prior sanitized decisions in append order. */
  priorDecisions: DecisionLogEntry[],
  /** Message IDs in durable retry state. */
  retryMessageIds: Set<string>,
): Map<string, string[]> {
  const labelsByMessageId = new Map<string, string[]>(
    Object.entries(state.retryOriginalLabelIds ?? {}),
  )
  for (const entry of priorDecisions) {
    if (
      retryMessageIds.has(entry.messageId) &&
      entry.decision === "error" &&
      MUTATION_ERROR_CLASSIFICATIONS.has(entry.classification) &&
      entry.originalLabels.length > 0
    ) {
      labelsByMessageId.set(entry.messageId, [...entry.originalLabels])
    }
  }
  return labelsByMessageId
}

/** Build one normalized durable state snapshot without empty optional retry metadata. */
function createStateSnapshot(
  /** Gmail history ID safe for this checkpoint. */
  lastHistoryId: string | null,
  /** Completion timestamp safe for this checkpoint. */
  lastCompletedAt: string | null,
  /** Message IDs requiring another attempt. */
  retryMessageIds: Set<string>,
  /** Exact archive-reversal senders. */
  archiveReversalSenders: Set<string>,
  /** Original labels needed for idempotent retries. */
  retryOriginalLabels: Map<string, string[]>,
): EmailProcessingState {
  const state: EmailProcessingState = {
    lastHistoryId,
    lastCompletedAt,
    retryMessageIds: [...retryMessageIds],
    archiveReversalSenders: [...archiveReversalSenders].sort(),
  }
  const retainedRetryLabels = Object.fromEntries(
    [...retryOriginalLabels].filter(([messageId]) => retryMessageIds.has(messageId)),
  )
  return Object.keys(retainedRetryLabels).length > 0
    ? { ...state, retryOriginalLabelIds: retainedRetryLabels }
    : state
}

/** Identify an explicit request Herb made in earlier thread context. */
function herbRequestedWork(
  /** Meaningful body from Herb's prior message. */
  body: string,
): boolean {
  return /\b(?:please|can you|could you|would you)\b/i.test(body)
}

/** Convert a prior Gmail message into inert classifier context. */
function toNormalizedThreadMessage(
  /** Prior Gmail message. */
  message: GmailMessage,
): NormalizedThreadMessage {
  return {
    receivedAt: toReceivedAt(message),
    sender: parseMailbox(getHeader(message, "From")),
    recipients: parseMailboxes([getHeader(message, "To"), getHeader(message, "Cc")]),
    subject: getHeader(message, "Subject"),
    body: getMeaningfulBody(message),
  }
}

/** Convert Gmail's trusted mailbox timestamp to RFC 3339. */
function toReceivedAt(
  /** Gmail message with an API-supplied internal date. */
  message: GmailMessage,
): string {
  const milliseconds = Number(message.internalDate)
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new Error(`Invalid Gmail internal date for message ID: ${message.id}`)
  }
  return new Date(milliseconds).toISOString()
}

/** Build a decision record without message content. */
function toDecisionLogEntry(
  /** Run timestamp. */
  timestamp: string,
  /** Original Gmail message. */
  message: GmailMessage,
  /** Normalized candidate. */
  candidate: ClassifierCandidate,
  /** Planned decision. */
  plan: PlannedDecision,
  /** Whether Gmail was left unchanged. */
  logOnly: boolean,
): DecisionLogEntry {
  return {
    policyVersion: POLICY_VERSION,
    timestamp,
    messageId: candidate.messageId,
    threadId: candidate.threadId,
    sender: formatMailbox(candidate.sender),
    // Keep one-time codes out of the log; Jev flags mail that is only a code or sign-in link.
    subject: plan.routineAuthentication ? redactCodes(candidate.subject) : candidate.subject,
    originalLabels: [...(message.labelIds ?? [])],
    decision: plan.decision,
    classification: plan.classification,
    confidence: plan.confidence,
    ...(logOnly ? { logOnly: true as const } : {}),
    reason: plan.reason,
    policySignals: policySignalsFor(candidate, plan),
    jev: plan.jev,
    unsubscribe: plan.unsubscribe,
    gmailUrl: gmailUrl(candidate.threadId),
  }
}

/** List the stable facts behind a decision, for reading the log. */
function policySignalsFor(
  /** Normalized candidate. */
  candidate: ClassifierCandidate,
  /** Planned decision. */
  plan: PlannedDecision,
): string[] {
  const protections = candidate.archiveProtections
  return [
    plan.jev.mailKind,
    ...(plan.jev.marketing >= MARKETING_THRESHOLD ? ["marketing"] : []),
    ...(candidate.bulkMail.listUnsubscribe ? ["list-unsubscribe"] : []),
    ...(candidate.bulkMail.oneClickUnsubscribeUrl ? ["one-click"] : []),
    ...(candidate.calendarMethod ? [calendarSignal(candidate.calendarMethod)] : []),
    ...(candidate.autoReply ? ["auto-reply"] : []),
    ...(candidate.keepLabeled ? ["keep-label"] : []),
    ...(protections.priorReply ? ["prior-reply"] : []),
    ...(protections.archiveReversal ? ["archive-reversal"] : []),
    ...(protections.activeConversation ? ["active-conversation"] : []),
    ...(protections.requestedWork ? ["requested-work"] : []),
    ...(protections.herbInitiated ? ["herb-initiated"] : []),
  ].filter((signal, index, signals) => signals.indexOf(signal) === index)
}

/** Name an iCalendar method as a signal, without passing through unknown header text. */
function calendarSignal(
  /** METHOD value from the attachment. */
  method: string,
): string {
  const name = method.toLowerCase()
  return CALENDAR_METHODS.has(name) ? `calendar-${name}` : "calendar"
}

/** Build an error record for a decision whose Gmail change failed. */
function toErrorLogEntry(
  /** Run timestamp. */
  timestamp: string,
  /** Original Gmail message. */
  message: GmailMessage,
  /** Normalized candidate. */
  candidate: ClassifierCandidate,
  /** Decision whose action failed. */
  plan: PlannedDecision,
  /** Stable error reason with no external response content. */
  reason: string,
  /** Raw inspected exception including stack and custom properties. */
  exception: string,
): DecisionLogEntry {
  return {
    ...createErrorLogEntry(
      timestamp,
      candidate.messageId,
      candidate.threadId,
      reason,
      message,
      candidate,
      exception,
    ),
    classification: `${plan.decision}-error`,
    policySignals: [plan.classification, "retry"],
  }
}

/** Build an error log with a stable reason and optional raw exception. */
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
  /** Raw inspected exception including stack and custom properties. */
  exception?: string,
): DecisionLogEntry {
  return {
    policyVersion: POLICY_VERSION,
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
    ...(exception !== undefined ? { exception } : {}),
    policySignals: ["retry"],
    gmailUrl: threadId ? gmailUrl(threadId) : "",
  }
}

/** Inspect a thrown value without truncating its stack, cause chain, or custom properties. */
function formatException(
  /** Value caught at a supervisor failure boundary. */
  error: unknown,
): string {
  return inspect(error, {
    breakLength: 120,
    compact: false,
    customInspect: false,
    depth: null,
    getters: false,
    maxArrayLength: null,
    maxStringLength: null,
    showHidden: true,
  })
}

/** Complete a retry safely when its message has left Inbox before any valid mutation. */
function createRetryNoActionLogEntry(
  /** Run timestamp. */
  timestamp: string,
  /** Current Gmail message. */
  message: GmailMessage,
): DecisionLogEntry {
  return {
    policyVersion: POLICY_VERSION,
    timestamp,
    messageId: message.id,
    threadId: message.threadId,
    sender: formatMailbox(parseMailbox(getHeader(message, "From"))),
    subject: getHeader(message, "Subject"),
    originalLabels: [...(message.labelIds ?? [])],
    decision: "none",
    classification: "no-action",
    confidence: "high",
    reason: "Message left Inbox before retry; no action taken.",
    policySignals: ["no-action"],
    gmailUrl: gmailUrl(message.threadId),
  }
}

/** Check that every message in a thread reflects an exact authorized delta. */
function threadHasMutation(
  /** Current Gmail thread. */
  thread: GmailThread,
  /** Intended label delta. */
  mutation: LabelMutation,
  /** Inbound message whose Inbox retention matters for promotion. */
  targetMessageId: string,
): boolean {
  const isPromotion = mutation.addLabelIds.includes("CATEGORY_PERSONAL")
  if (
    isPromotion &&
    !thread.messages.find(message => message.id === targetMessageId)?.labelIds?.includes("INBOX")
  ) {
    return false
  }
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
  /** Whether a checkpointed mutation began while the message was in Inbox. */
  isInboxMutationRetry: boolean,
): boolean {
  const labels = new Set(message.labelIds ?? [])
  return (
    (isInboxMutationRetry || labels.has("INBOX")) && !labels.has("SPAM") && !labels.has("TRASH")
  )
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

/** Map Gmail system labels to a stable category. */
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

/** Replace code-like tokens that contain a digit, such as "AB12-CD34". */
function redactCodes(
  /** Subject text. */
  subject: string,
): string {
  return subject.replace(/\b[A-Z0-9-]{4,10}\b/g, code => (/\d/.test(code) ? "[code]" : code))
}

/** Build the Gmail web link for a thread. */
function gmailUrl(
  /** Gmail thread ID. */
  threadId: string,
): string {
  return `https://mail.google.com/mail/#all/${encodeURIComponent(threadId)}`
}

/** Round a probability to two decimals. */
function round(
  /** Probability. */
  value: number,
): number {
  return Math.round(value * 100) / 100
}

/** Convert a snake_case option name to kebab-case. */
function kebab(
  /** Snake-case name. */
  value: string,
): string {
  return value.replaceAll("_", "-")
}

/** Deduplicate strings without changing first-seen order. */
function unique(
  /** Values to deduplicate. */
  values: string[],
): string[] {
  return [...new Set(values)]
}

/** Extract an exact lowercase address from a previously formatted sender. */
export function extractLoggedAddress(
  /** Sanitized sender string. */
  sender: string,
): string {
  const angleMatch = sender.match(/<([^<>]+)>\s*$/)
  return (angleMatch?.[1] ?? sender).trim().toLowerCase()
}

/** Create zeroed public result counts. */
function emptyResult(): GmailSupervisorResult {
  return { archived: 0, promoted: 0, unchanged: 0, retried: 0, pending: 0, corrected: 0 }
}

// CONSTANTS

/** Gmail labels that place a message outside Primary. */
const NON_PRIMARY_CATEGORY_LABELS = new Set([
  "CATEGORY_UPDATES",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
])

/** iCalendar METHOD values (RFC 5546). */
const CALENDAR_METHODS = new Set([
  "publish",
  "request",
  "reply",
  "add",
  "cancel",
  "refresh",
  "counter",
  "declinecounter",
])

/** Mutation failures whose durable log preserves pre-mutation labels for idempotent replay. */
const MUTATION_ERROR_CLASSIFICATIONS = new Set(["archive-error", "promote-error"])

/** Reasons for decisions made by a rule rather than by Jev's keep answer. */
const RULE_REASONS: Partial<Record<string, string>> = {
  "keep-label": "Herb's Keep label is on the message.",
  "archive-reversal": "Herb has returned this sender's mail to the inbox before.",
  "calendar-reply": "A reply to a calendar invitation.",
  "calendar-invitation": "A calendar invitation, which stays so it remains on the calendar.",
  "auto-reply": "An automatic reply.",
  marketing: "Marketing, by Jev's mail kind.",
  correspondent: "Personal mail from someone Herb writes to.",
  "devresults-sender": "The sender is at devresults.com, which the job never archives.",
}

// TYPES

/** A decision with the label change, log fields and Jev summary the supervisor needs. */
export type PlannedDecision = JevDecision & {
  /** Exact authorized label delta, or null to leave the thread alone. */
  mutation: LabelMutation | null
  /** Qualitative certainty for the log. */
  confidence: DecisionLogEntry["confidence"]
  /** One sentence for the log. */
  reason: string
  /** Whether Jev says the message is only a code or sign-in link. */
  routineAuthentication: boolean
  /** Jev's model and deciding answers. */
  jev: NonNullable<DecisionLogEntry["jev"]>
}
