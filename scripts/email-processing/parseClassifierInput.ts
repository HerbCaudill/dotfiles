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

  const candidateIds = new Set<string>()
  for (const [index, candidate] of input.candidates.entries()) {
    if (candidateIds.has(candidate.messageId)) {
      throw new Error(`Duplicate candidate message ID: ${candidate.messageId}`)
    }
    candidateIds.add(candidate.messageId)

    validateMailbox(candidate.sender, `$.candidates[${index}].sender`)
    candidate.recipients.forEach((mailbox, recipientIndex) =>
      validateMailbox(mailbox, `$.candidates[${index}].recipients[${recipientIndex}]`),
    )
    candidate.thread.forEach((message, messageIndex) => {
      validateMailbox(message.sender, `$.candidates[${index}].thread[${messageIndex}].sender`)
      message.recipients.forEach((mailbox, recipientIndex) =>
        validateMailbox(
          mailbox,
          `$.candidates[${index}].thread[${messageIndex}].recipients[${recipientIndex}]`,
        ),
      )
    })
    candidate.promotionCorrections.forEach((correction, correctionIndex) =>
      validateMailbox(
        correction.sender,
        `$.candidates[${index}].promotionCorrections[${correctionIndex}].sender`,
      ),
    )
  }

  return input
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
