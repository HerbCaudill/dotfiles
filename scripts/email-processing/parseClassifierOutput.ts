import { classifierOutputJsonSchema } from "./classifierOutputJsonSchema.ts"
import type { ArchiveClassification, ClassifierOutput, PromoteClassification } from "./types.ts"
import { validateJsonSchema } from "./validateJsonSchema.ts"

/** Parse and validate a strict structured classifier result. */
export function parseClassifierOutput(
  /** Untrusted classifier result. */
  value: unknown,
): ClassifierOutput {
  validateJsonSchema(value, classifierOutputJsonSchema)
  const output = value as StructurallyValidOutput
  const messageIds = new Set<string>()

  output.decisions.forEach((decision, index) => {
    validateDecisionVariant(decision, `$.decisions[${index}]`)
    if (messageIds.has(decision.messageId)) {
      throw new Error(`Duplicate classifier decision for message ID: ${decision.messageId}`)
    }
    messageIds.add(decision.messageId)
  })

  return output as ClassifierOutput
}

/** Validate the relationship between action, category, and confidence. */
function validateDecisionVariant(
  /** Structurally valid decision. */
  decision: StructurallyValidDecision,
  /** Human-readable JSON path. */
  path: string,
): void {
  if (
    decision.decision === "archive" &&
    ARCHIVE_CLASSIFICATIONS.has(decision.classification as ArchiveClassification) &&
    decision.confidence === "high"
  ) {
    return
  }

  if (
    decision.decision === "promote" &&
    PROMOTE_CLASSIFICATIONS.has(decision.classification as PromoteClassification) &&
    decision.confidence !== "low"
  ) {
    return
  }

  if (decision.decision === "none" && decision.classification === "no-action") return
  throw new Error(`${path} has an invalid decision, classification, or confidence combination`)
}

// CONSTANTS

const ARCHIVE_CLASSIFICATIONS = new Set<ArchiveClassification>([
  "cold-vendor",
  "cold-job-inquiry",
  "cold-investor",
  "generic-solicitation",
  "misfiled-marketing",
  "delegated-customer",
])

const PROMOTE_CLASSIFICATIONS = new Set<PromoteClassification>([
  "personal-message",
  "explicit-action",
  "scheduling-exception",
  "account-security",
  "operational-failure",
  "medical-action",
  "financial-anomaly",
  "service-decision",
  "active-work",
])

// TYPES

type StructurallyValidOutput = {
  /** Structurally valid decisions whose variant relationships remain untrusted. */
  decisions: StructurallyValidDecision[]
}

type StructurallyValidDecision = {
  /** Candidate message ID. */
  messageId: string
  /** Requested policy action. */
  decision: "archive" | "promote" | "none"
  /** Stable classifier category before variant validation. */
  classification: ArchiveClassification | PromoteClassification | "no-action"
  /** Confidence before variant validation. */
  confidence: "high" | "medium" | "low"
  /** Concise classifier explanation. */
  reason: string
  /** Short classifier evidence labels. */
  policySignals: string[]
}
