import {
  EMAIL_PROCESSING_ACCOUNT,
  MAX_ACTIONS_PER_RUN,
  MAX_CANDIDATES_PER_RUN,
  MAX_CLASSIFIER_CANDIDATES,
  MAX_CLASSIFIER_INPUT_BYTES,
} from "./constants.ts"
import { parseClassifierInput } from "./parseClassifierInput.ts"
import { parseClassifierOutput } from "./parseClassifierOutput.ts"
import { sanitizeDecisionLogEntry } from "./sanitizeDecisionLogEntry.ts"
import type {
  ClassifierCandidate,
  NormalizedMailbox,
  NormalizedThreadMessage,
  PromotionCorrectionEvidence,
} from "./types.ts"
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
  const archiveReversalSenders = getArchiveReversalSenders(state, priorDecisions)
  const protectedCorrespondentSenders = getProtectedCorrespondentSenders(priorDecisions)
  const correctedMessageIds = await recordCorrections(
    timestamp,
    labelChanges,
    priorDecisions,
    archiveReversalSenders,
    dependencies,
  )
  result.corrected = correctedMessageIds.size
  const promotionCorrectionEntries = priorDecisions.filter(isPromotionCorrectionEntry).slice(-20)
  const completedMessageIds = getCompletedMessageIds(priorDecisions)
  const supersededRetryMessageIds = getSupersededRetryMessageIds(priorDecisions)
  const retryMessageIds = new Set([
    ...state.retryMessageIds.filter(
      messageId => !completedMessageIds.has(messageId) && !supersededRetryMessageIds.has(messageId),
    ),
    ...getLoggedRetryMessageIds(priorDecisions).filter(
      messageId => !supersededRetryMessageIds.has(messageId),
    ),
  ])
  const candidateIds = unique([
    ...discovered.map(message => message.messageId),
    ...retryMessageIds,
  ]).filter(messageId => !correctedMessageIds.has(messageId) && !completedMessageIds.has(messageId))
  const pendingMessageIds = new Set(candidateIds.slice(MAX_CANDIDATES_PER_RUN))
  pendingMessageIds.forEach(messageId => retryMessageIds.add(messageId))
  const selectedCandidateIds = candidateIds.slice(0, MAX_CANDIDATES_PER_RUN)
  const candidates: ClassifierCandidate[] = []
  const messagesById = new Map<string, GmailMessage>()
  const threadsById = new Map<string, GmailThread>()
  const retryOriginalLabels = getRetryOriginalLabels(state, priorDecisions, retryMessageIds)
  const candidateIdSet = new Set(candidateIds)
  const plannedThreadIds = new Set<string>()
  const supersededRetriesByMessageId = new Map<string, string[]>()

  for (const messageId of selectedCandidateIds) {
    let inspectedMessageId = messageId
    try {
      const message = await dependencies.gmail.getMessage(messageId)
      if (plannedThreadIds.has(message.threadId)) continue
      if (!isProcessable(message, retryMessageIds.has(messageId))) continue
      const thread = await dependencies.gmail.getThread(message.threadId)
      const targetMessage = findNewestThreadCandidate(thread, candidateIdSet, retryMessageIds)
      if (!targetMessage) continue
      inspectedMessageId = targetMessage.id
      pendingMessageIds.delete(targetMessage.id)
      plannedThreadIds.add(thread.id)
      const targetIndex = thread.messages.findIndex(
        threadMessage => threadMessage.id === targetMessage.id,
      )
      supersededRetriesByMessageId.set(
        targetMessage.id,
        thread.messages
          .slice(0, targetIndex)
          .map(threadMessage => threadMessage.id)
          .filter(threadMessageId => retryMessageIds.has(threadMessageId)),
      )
      const candidate = await normalizeCandidate(
        targetMessage,
        thread,
        { ...state, archiveReversalSenders: [...archiveReversalSenders] },
        dependencies,
        retryOriginalLabels.get(targetMessage.id),
        protectedCorrespondentSenders,
        promotionCorrectionEntries,
      )
      candidates.push(candidate)
      messagesById.set(
        targetMessage.id,
        retryOriginalLabels.has(targetMessage.id)
          ? { ...targetMessage, labelIds: retryOriginalLabels.get(targetMessage.id) }
          : targetMessage,
      )
      threadsById.set(targetMessage.id, thread)
    } catch {
      retryMessageIds.add(inspectedMessageId)
      await dependencies.appendDecision(
        sanitizeDecisionLogEntry(
          createErrorLogEntry(timestamp, inspectedMessageId, "", "Candidate inspection failed"),
        ),
      )
    }
  }

  if (candidates.length > 0) {
    let decisions: ReturnType<typeof validateClassifications> = []
    let requestedActionCount = 0
    const classifierCandidates: ClassifierCandidate[] = []
    for (const candidate of candidates) {
      try {
        classifierCandidates.push(prepareClassifierCandidate(candidate))
      } catch {
        await recordClassifierFailures(
          timestamp,
          [candidate],
          messagesById,
          retryMessageIds,
          dependencies,
          "Candidate validation failed",
        )
      }
    }
    for (const batch of createClassifierBatches(classifierCandidates)) {
      try {
        const input = { account: EMAIL_PROCESSING_ACCOUNT, candidates: batch }
        const output = await dependencies.classify(input)
        const parsedOutput = parseClassifierOutput(output)
        requestedActionCount += parsedOutput.decisions.filter(
          decision => decision.decision !== "none",
        ).length
        decisions.push(...validateClassifications(input, parsedOutput))
      } catch {
        await recordClassifierFailures(
          timestamp,
          batch,
          messagesById,
          retryMessageIds,
          dependencies,
        )
      }
    }
    if (requestedActionCount > MAX_ACTIONS_PER_RUN) {
      await recordClassifierFailures(
        timestamp,
        decisions.map(
          decision => candidates.find(candidate => candidate.messageId === decision.messageId)!,
        ),
        messagesById,
        retryMessageIds,
        dependencies,
      )
      decisions = []
    }

    for (const decision of decisions) {
      const message = messagesById.get(decision.messageId)!
      const thread = threadsById.get(decision.messageId)!
      if (decision.mutation) {
        retryMessageIds.add(decision.messageId)
        retryOriginalLabels.set(decision.messageId, [...(message.labelIds ?? [])])
        await dependencies.saveState(
          createStateSnapshot(
            state.lastHistoryId,
            state.lastCompletedAt,
            retryMessageIds,
            archiveReversalSenders,
            retryOriginalLabels,
          ),
        )
        try {
          if (!threadHasMutation(thread, decision.mutation, decision.messageId)) {
            await dependencies.gmail.modifyThreadLabels(decision.threadId, decision.mutation)
          }
          const verifiedThread = await dependencies.gmail.getThread(decision.threadId)
          if (!threadHasMutation(verifiedThread, decision.mutation, decision.messageId)) {
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

      try {
        await dependencies.appendDecision(
          sanitizeDecisionLogEntry(toDecisionLogEntry(timestamp, message, candidates, decision)),
        )
      } catch {
        retryMessageIds.add(decision.messageId)
        if (decision.mutation) {
          retryOriginalLabels.set(decision.messageId, [...(message.labelIds ?? [])])
        } else {
          retryOriginalLabels.delete(decision.messageId)
        }
        await dependencies.saveState(
          createStateSnapshot(
            state.lastHistoryId,
            state.lastCompletedAt,
            retryMessageIds,
            archiveReversalSenders,
            retryOriginalLabels,
          ),
        )
        continue
      }
      retryMessageIds.delete(decision.messageId)
      retryOriginalLabels.delete(decision.messageId)
      for (const supersededMessageId of supersededRetriesByMessageId.get(decision.messageId) ??
        []) {
        retryMessageIds.delete(supersededMessageId)
        retryOriginalLabels.delete(supersededMessageId)
      }
      if (decision.decision === "archive") result.archived += 1
      if (decision.decision === "promote") result.promoted += 1
      if (decision.decision === "none") result.unchanged += 1
    }
  }

  const nextState = createStateSnapshot(
    profile.historyId,
    timestamp,
    retryMessageIds,
    archiveReversalSenders,
    retryOriginalLabels,
  )
  await dependencies.saveState(nextState)
  result.pending = [...pendingMessageIds].filter(messageId => retryMessageIds.has(messageId)).length
  result.retried = retryMessageIds.size - result.pending
  return result
}

/** Record classifier failures for one bounded batch without blocking later batches. */
async function recordClassifierFailures(
  /** Run timestamp. */
  timestamp: string,
  /** Candidates whose classifier call failed validation or execution. */
  candidates: ClassifierCandidate[],
  /** Fetched Gmail messages keyed by candidate ID. */
  messagesById: ReadonlyMap<string, GmailMessage>,
  /** Mutable retry IDs for this run. */
  retryMessageIds: Set<string>,
  /** Supervisor boundaries used for durable logging. */
  dependencies: GmailSupervisorDependencies,
  /** Stable audit reason for this failed batch. */
  reason = "Classifier failed",
): Promise<void> {
  for (const candidate of candidates) {
    retryMessageIds.add(candidate.messageId)
    await dependencies.appendDecision(
      sanitizeDecisionLogEntry(
        createErrorLogEntry(
          timestamp,
          candidate.messageId,
          candidate.threadId,
          reason,
          messagesById.get(candidate.messageId),
          candidate,
        ),
      ),
    )
  }
}

/** Split candidates into schema- and byte-bounded classifier inputs. */
function createClassifierBatches(
  /** All candidates normalized for this supervisor run. */
  candidates: ClassifierCandidate[],
): ClassifierCandidate[][] {
  const batches: ClassifierCandidate[][] = []
  let currentBatch: ClassifierCandidate[] = []

  for (const candidate of candidates) {
    const nextBatch = [...currentBatch, candidate]
    if (
      currentBatch.length > 0 &&
      (nextBatch.length > MAX_CLASSIFIER_CANDIDATES ||
        classifierInputBytes(nextBatch) > MAX_CLASSIFIER_INPUT_BYTES)
    ) {
      batches.push(currentBatch)
      currentBatch = [candidate]
    } else {
      currentBatch = nextBatch
    }
  }
  if (currentBatch.length > 0) batches.push(currentBatch)
  return batches
}

/** Bound one candidate by bytes and then validate every strict per-field schema limit. */
function prepareClassifierCandidate(
  /** Candidate normalized from Gmail. */
  candidate: ClassifierCandidate,
): ClassifierCandidate {
  const boundedCandidate = fitCandidateToClassifierLimit(candidate)
  return parseClassifierInput({
    account: EMAIL_PROCESSING_ACCOUNT,
    candidates: [boundedCandidate],
  }).candidates[0]!
}

/** Drop only oldest thread context until one candidate fits the classifier byte boundary. */
function fitCandidateToClassifierLimit(
  /** Candidate whose current message must remain complete. */
  candidate: ClassifierCandidate,
): ClassifierCandidate {
  let boundedCandidate = candidate
  while (classifierInputBytes([boundedCandidate]) > MAX_CLASSIFIER_INPUT_BYTES) {
    if (boundedCandidate.thread.length === 0) {
      throw new Error(`Classifier candidate exceeds byte limit: ${candidate.messageId}`)
    }
    boundedCandidate = { ...boundedCandidate, thread: boundedCandidate.thread.slice(1) }
  }
  return boundedCandidate
}

/** Count UTF-8 bytes for one exact classifier input batch. */
function classifierInputBytes(
  /** Candidate batch. */
  candidates: ClassifierCandidate[],
): number {
  return Buffer.byteLength(
    JSON.stringify({ account: EMAIL_PROCESSING_ACCOUNT, candidates }),
    "utf8",
  )
}

/** Return message IDs whose latest durable record requires another attempt. */
function getLoggedRetryMessageIds(
  /** Prior sanitized decisions in append order. */
  priorDecisions: DecisionLogEntry[],
): string[] {
  const latestByMessageId = new Map<string, DecisionLogEntry>()
  for (const entry of priorDecisions) latestByMessageId.set(entry.messageId, entry)
  return [...latestByMessageId.values()]
    .filter(entry => entry.decision === "error")
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
  /** Message IDs that remain eligible outside Inbox. */
  retryMessageIds: Set<string>,
): GmailMessage | undefined {
  return [...thread.messages]
    .reverse()
    .find(
      message =>
        candidateMessageIds.has(message.id) &&
        isProcessable(message, retryMessageIds.has(message.id)),
    )
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
    const correction = sanitizeDecisionLogEntry({
      ...prior,
      timestamp,
      decision: "correction",
      classification,
      confidence: "high",
      reason: correctionReason(classification),
      policySignals: [classification],
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
  /** Exact senders established as protected correspondents by prior decisions. */
  protectedCorrespondentSenders = new Set<string>(),
  /** Recent sanitized promotion-correction log entries. */
  promotionCorrectionEntries: DecisionLogEntry[] = [],
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
  const requestedWork = herbMessages.some(message => herbRequestedWork(message.body))

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
      protectedCorrespondent:
        protectedCorrespondentSenders.has(sender.address) ||
        requestedWork ||
        hasProtectedCorrespondentSignals(subject, body),
      activeConversation: herbMessages.length > 0,
      requestedWork,
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
    promotionCorrections: promotionCorrectionEntries.map(entry =>
      toPromotionCorrectionEvidence(entry, sender.address),
    ),
  }
}

/** Check whether a log entry carries one supported promotion correction. */
function isPromotionCorrectionEntry(
  /** Prior sanitized decision. */
  entry: DecisionLogEntry,
): boolean {
  return (
    entry.decision === "correction" &&
    (entry.classification === "promotion-reversed" || entry.classification === "promotion-missed")
  )
}

/** Convert a sanitized correction log entry into bounded inert classifier evidence. */
function toPromotionCorrectionEvidence(
  /** Prior sanitized promotion correction. */
  entry: DecisionLogEntry,
  /** Exact current candidate sender address. */
  candidateSenderAddress: string,
): PromotionCorrectionEvidence {
  const sender = parseMailbox(entry.sender)
  return {
    timestamp: entry.timestamp,
    correction: entry.classification as PromotionCorrectionEvidence["correction"],
    sender,
    subject: entry.subject,
    exactSender: sender.address === candidateSenderAddress,
  }
}

/** Derive exact protected correspondents from stable prior personal and medical decisions. */
function getProtectedCorrespondentSenders(
  /** Prior sanitized decisions. */
  priorDecisions: DecisionLogEntry[],
): Set<string> {
  return new Set(
    priorDecisions
      .filter(
        entry =>
          entry.decision === "promote" &&
          PROTECTED_CORRESPONDENT_CLASSIFICATIONS.has(entry.classification),
      )
      .map(entry => extractLoggedAddress(entry.sender))
      .filter(Boolean),
  )
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

/** Identify explicit current-message evidence of a protected personal or medical relationship. */
function hasProtectedCorrespondentSignals(
  /** Message subject. */
  subject: string,
  /** Complete meaningful body. */
  body: string,
): boolean {
  const content = `${subject}\n${body}`
  return PERSONAL_RELATIONSHIP_PATTERN.test(content) || MEDICAL_PROVIDER_PATTERN.test(content)
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
    policySignals: [decision.classification, ...decision.policySignals, "retry"],
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
  return { archived: 0, promoted: 0, unchanged: 0, retried: 0, pending: 0, corrected: 0 }
}

/** Gmail labels that place a message outside Primary. */
const NON_PRIMARY_CATEGORY_LABELS = new Set([
  "CATEGORY_UPDATES",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
])

/** Prior promotion categories that establish an exact protected correspondent. */
const PROTECTED_CORRESPONDENT_CLASSIFICATIONS = new Set(["personal-message", "medical-action"])

/** Mutation failures whose durable log preserves pre-mutation labels for idempotent replay. */
const MUTATION_ERROR_CLASSIFICATIONS = new Set(["archive-error", "promote-error"])

/** Explicit relationship terms that conservatively identify personal correspondents. */
const PERSONAL_RELATIONSHIP_PATTERN =
  /\b(?:(?:my|your|our)\s+)?(?:family|friend|mother|father|mom|dad|parent|wife|husband|spouse|partner|son|daughter|child|brother|sister|sibling|cousin|aunt|uncle|niece|nephew|grandmother|grandfather|grandparent)\b/i

/** Explicit care-provider terms that conservatively identify medical correspondents. */
const MEDICAL_PROVIDER_PATTERN =
  /\b(?:medical provider|doctor|physician|cardiologist|dentist|orthodontist|therapist|psychologist|psychiatrist|clinician|clinic|hospital|pharmacy|pharmacist|laboratory|radiologist|specialist)\b/i
