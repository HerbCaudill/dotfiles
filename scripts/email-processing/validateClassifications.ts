import {
  ARCHIVE_LABEL_MUTATION,
  MAX_ACTIONS_PER_RUN,
  PROMOTABLE_CATEGORIES,
  PROMOTE_LABEL_MUTATION,
} from "./constants.ts"
import { parseClassifierInput } from "./parseClassifierInput.ts"
import { parseClassifierOutput } from "./parseClassifierOutput.ts"
import type {
  ArchiveProtections,
  ClassifierCandidate,
  ClassifierDecision,
  ValidatedClassification,
} from "./types.ts"
import { validateLabelMutation } from "./validateLabelMutation.ts"

/** Validate a complete classifier batch and derive only authorized Gmail mutations. */
export function validateClassifications(
  /** Normalized candidate input. */
  inputValue: unknown,
  /** Untrusted classifier result. */
  outputValue: unknown,
): ValidatedClassification[] {
  const input = parseClassifierInput(inputValue)
  const output = parseClassifierOutput(outputValue)
  const candidatesById = new Map(
    input.candidates.map(candidate => [candidate.messageId, candidate]),
  )

  for (const decision of output.decisions) {
    if (!candidatesById.has(decision.messageId)) {
      throw new Error(`Unknown candidate message ID: ${decision.messageId}`)
    }
  }

  for (const candidate of input.candidates) {
    if (!output.decisions.some(decision => decision.messageId === candidate.messageId)) {
      throw new Error(`Missing classifier decision for message ID: ${candidate.messageId}`)
    }
  }

  const actionCount = output.decisions.filter(decision => decision.decision !== "none").length
  if (actionCount > MAX_ACTIONS_PER_RUN) {
    throw new Error(`Action limit of ${MAX_ACTIONS_PER_RUN} exceeded`)
  }

  return output.decisions.map(decision =>
    validateDecision(decision, candidatesById.get(decision.messageId)!),
  )
}

/** Validate one decision against deterministic facts for its offered candidate. */
function validateDecision(
  /** Structurally valid classifier decision. */
  decision: ClassifierDecision,
  /** Matching offered candidate. */
  candidate: ClassifierCandidate,
): ValidatedClassification {
  if (decision.decision === "archive") {
    validateArchiveDecision(decision, candidate)
    return {
      ...decision,
      threadId: candidate.threadId,
      mutation: validateLabelMutation(ARCHIVE_LABEL_MUTATION),
    }
  }

  if (decision.decision === "promote") {
    if (
      !PROMOTABLE_CATEGORIES.includes(candidate.category as (typeof PROMOTABLE_CATEGORIES)[number])
    ) {
      throw new Error(`Promotion is not eligible for message ID: ${candidate.messageId}`)
    }
    return {
      ...decision,
      threadId: candidate.threadId,
      mutation: validateLabelMutation(PROMOTE_LABEL_MUTATION),
    }
  }

  return { ...decision, threadId: candidate.threadId, mutation: null }
}

/** Apply hard archive vetoes and the narrow delegated-customer exception. */
function validateArchiveDecision(
  /** Archive decision to validate. */
  decision: Extract<ClassifierDecision, { decision: "archive" }>,
  /** Matching offered candidate. */
  candidate: ClassifierCandidate,
): void {
  if (candidate.sender.address.endsWith("@devresults.com")) {
    throw new Error(`Archive decision is blocked for message ID: ${candidate.messageId}`)
  }

  if (decision.classification === "delegated-customer") {
    const facts = candidate.delegatedCustomer
    if (!facts.customerInquiry || !facts.otherDevResultsRecipient || facts.requiresHerbAction) {
      throw new Error(
        `Delegated customer archive is not eligible for message ID: ${candidate.messageId}`,
      )
    }

    const protectionsExceptPriorReply = Object.entries(candidate.archiveProtections).filter(
      ([name, active]) => name !== "priorReply" && active,
    )
    if (protectionsExceptPriorReply.length > 0) {
      throw new Error(`Archive decision is blocked for message ID: ${candidate.messageId}`)
    }
    return
  }

  if (hasArchiveProtection(candidate.archiveProtections)) {
    throw new Error(`Archive decision is blocked for message ID: ${candidate.messageId}`)
  }
}

/** Check whether any hard unwanted-mail protection applies. */
function hasArchiveProtection(
  /** Supervisor-computed protection facts. */
  protections: ArchiveProtections,
): boolean {
  return Object.values(protections).some(Boolean)
}
