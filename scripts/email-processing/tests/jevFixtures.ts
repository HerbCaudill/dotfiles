import type { JevClassification } from "../classifyWithJev.ts"
import type { MailKind } from "../decideFromJevAnswers.ts"

const MAIL_KINDS: MailKind[] = [
  "personal",
  "cold_outreach",
  "marketing",
  "editorial",
  "transactional",
  "notification",
  "government",
]

/** Build Jev's answers for one message: a mail kind with its probability and a keep probability. */
export function jevResult(
  /** Answer overrides. */
  options: {
    /** Most likely mail kind. */
    mailKind?: MailKind
    /** Probability of the most likely mail kind. */
    probability?: number
    /** Probability that Herb keeps the message. */
    keep?: number
    /** Probability that the message is only a code or sign-in link. */
    routine?: number
  } = {},
): JevClassification {
  const mailKind = options.mailKind ?? "transactional"
  const probability = options.probability ?? 0.95
  const probabilities: Record<string, number> = Object.fromEntries(
    MAIL_KINDS.map(kind => [kind, 0]),
  )
  probabilities[mailKind] = probability
  probabilities[mailKind === "personal" ? "notification" : "personal"] = 1 - probability
  return {
    model: "jev-test",
    inputTokens: 1000,
    latencyMs: 100,
    answers: {
      mail_kind: { type: "choice", choice: mailKind, confidence: probability, probabilities },
      cold_type: {
        type: "choice",
        choice: "cold_vendor",
        confidence: 0.9,
        probabilities: { cold_vendor: 0.95, generic_solicitation: 0.05 },
      },
      keep_in_inbox: { type: "noul", noul: options.keep ?? 0.05 },
      attention_reason: {
        type: "choice",
        choice: "explicit_action",
        confidence: 0.8,
        probabilities: { explicit_action: 0.9, active_work: 0.1 },
      },
      routine_authentication: { type: "noul", noul: options.routine ?? 0.02 },
    },
  }
}

/** Jev says Herb would archive this transactional message. */
export const archiveJev = jevResult()

/** Jev says Herb keeps this message: it stays in Primary, or is promoted from another tab. */
export const keepJev = jevResult({ mailKind: "personal", keep: 0.9 })

/** Jev says this is clear marketing. */
export const marketingJev = jevResult({ mailKind: "marketing" })
