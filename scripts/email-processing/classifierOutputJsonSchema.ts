import type { JsonSchema } from "./types.ts"

/** Strict JSON Schema for classifier decisions without commands or Gmail labels. */
export const classifierOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      maxItems: 100,
      items: {
        anyOf: [
          createDecisionSchema(
            "archive",
            [
              "cold-vendor",
              "cold-job-inquiry",
              "cold-investor",
              "generic-solicitation",
              "misfiled-marketing",
              "delegated-customer",
            ],
            ["high"],
          ),
          createDecisionSchema(
            "promote",
            [
              "personal-message",
              "explicit-action",
              "scheduling-exception",
              "account-security",
              "operational-failure",
              "medical-action",
              "financial-anomaly",
              "service-decision",
              "active-work",
            ],
            ["high", "medium"],
          ),
          createDecisionSchema("none", ["no-action"], ["high", "medium", "low"]),
        ],
      },
    },
  },
} as const satisfies JsonSchema

/** Create one strict discriminated decision schema. */
function createDecisionSchema(
  /** Required decision value. */
  decision: "archive" | "promote" | "none",
  /** Classifications valid for the decision. */
  classifications: readonly string[],
  /** Confidence values valid for the decision. */
  confidences: readonly string[],
) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["messageId", "decision", "classification", "confidence", "reason", "policySignals"],
    properties: {
      messageId: { type: "string", minLength: 1, maxLength: 256 },
      decision: { const: decision },
      classification: { enum: classifications },
      confidence: { enum: confidences },
      reason: { type: "string", minLength: 1, maxLength: 500 },
      policySignals: {
        type: "array",
        maxItems: 20,
        items: { type: "string", minLength: 1, maxLength: 100 },
      },
    },
  } as const
}
