import { classifierInputJsonSchema } from "./classifierInputJsonSchema.ts"
import type { ClassifierInput, NormalizedMailbox } from "./types.ts"
import { validateJsonSchema } from "./validateJsonSchema.ts"

/** Parse and validate normalized inert classifier input. */
export function parseClassifierInput(
  /** Untrusted value crossing the classifier contract boundary. */
  value: unknown,
): ClassifierInput {
  validateJsonSchema(value, classifierInputJsonSchema)
  const input = value as ClassifierInput
  validateTimestamp(input.evaluatedAt, "$.evaluatedAt")
  if (!/^sha256:[a-f0-9]{64}$/.test(input.policyVersion)) {
    throw new Error("$.policyVersion must be a SHA-256 policy version")
  }

  const candidateIds = new Set<string>()
  for (const [index, candidate] of input.candidates.entries()) {
    validateTimestamp(candidate.receivedAt, `$.candidates[${index}].receivedAt`)
    if (candidateIds.has(candidate.messageId)) {
      throw new Error(`Duplicate candidate message ID: ${candidate.messageId}`)
    }
    candidateIds.add(candidate.messageId)

    validateMailbox(candidate.sender, `$.candidates[${index}].sender`)
    candidate.recipients.forEach((mailbox, recipientIndex) =>
      validateMailbox(mailbox, `$.candidates[${index}].recipients[${recipientIndex}]`),
    )
    candidate.thread.forEach((message, messageIndex) => {
      validateTimestamp(
        message.receivedAt,
        `$.candidates[${index}].thread[${messageIndex}].receivedAt`,
      )
      validateMailbox(message.sender, `$.candidates[${index}].thread[${messageIndex}].sender`)
      message.recipients.forEach((mailbox, recipientIndex) =>
        validateMailbox(
          mailbox,
          `$.candidates[${index}].thread[${messageIndex}].recipients[${recipientIndex}]`,
        ),
      )
    })
    candidate.promotionCorrections.forEach((correction, correctionIndex) => {
      validateTimestamp(
        correction.timestamp,
        `$.candidates[${index}].promotionCorrections[${correctionIndex}].timestamp`,
      )
      validateMailbox(
        correction.sender,
        `$.candidates[${index}].promotionCorrections[${correctionIndex}].sender`,
      )
    })
  }

  return input
}

/** Validate one RFC 3339 timestamp used for freshness comparisons. */
function validateTimestamp(
  /** Timestamp to validate. */
  value: string,
  /** Human-readable JSON path. */
  path: string,
): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${path} must be an RFC 3339 timestamp`)
}

/** Validate one normalized mailbox value beyond JSON Schema structure. */
function validateMailbox(
  /** Mailbox to validate. */
  mailbox: NormalizedMailbox,
  /** Human-readable JSON path. */
  path: string,
): void {
  if (mailbox.name !== mailbox.name.trim()) throw new Error(`${path}.name must be trimmed`)
  if (mailbox.address !== mailbox.address.trim().toLowerCase() || !mailbox.address.includes("@")) {
    throw new Error(`${path}.address must be a normalized lowercase email address`)
  }
}
