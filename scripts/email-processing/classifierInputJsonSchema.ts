import {
  EMAIL_PROCESSING_ACCOUNT,
  MAX_CLASSIFIER_CANDIDATES,
  PROMOTABLE_CATEGORIES,
} from "./constants.ts"
import type { JsonSchema } from "./types.ts"

/** Strict JSON Schema for normalized inert classifier input. */
export const classifierInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["evaluatedAt", "policyVersion", "account", "candidates"],
  properties: {
    evaluatedAt: { type: "string", minLength: 1, maxLength: 100 },
    policyVersion: { type: "string", minLength: 8, maxLength: 100 },
    account: { const: EMAIL_PROCESSING_ACCOUNT },
    candidates: {
      type: "array",
      maxItems: MAX_CLASSIFIER_CANDIDATES,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "messageId",
          "threadId",
          "receivedAt",
          "sender",
          "recipients",
          "subject",
          "body",
          "thread",
          "category",
          "archiveProtections",
          "delegatedCustomer",
          "promotionCorrections",
        ],
        properties: {
          messageId: { type: "string", minLength: 1, maxLength: 256 },
          threadId: { type: "string", minLength: 1, maxLength: 256 },
          receivedAt: { type: "string", minLength: 1, maxLength: 100 },
          sender: { $ref: "#/$defs/mailbox" },
          recipients: {
            type: "array",
            maxItems: 100,
            items: { $ref: "#/$defs/mailbox" },
          },
          subject: { type: "string", maxLength: 2_000 },
          body: { type: "string", maxLength: 100_000 },
          thread: {
            type: "array",
            maxItems: 100,
            items: { $ref: "#/$defs/threadMessage" },
          },
          category: { enum: ["primary", ...PROMOTABLE_CATEGORIES] },
          archiveProtections: {
            type: "object",
            additionalProperties: false,
            required: [
              "devResultsSender",
              "priorReply",
              "archiveReversal",
              "protectedCorrespondent",
              "activeConversation",
              "requestedWork",
              "herbInitiated",
            ],
            properties: {
              devResultsSender: { type: "boolean" },
              priorReply: { type: "boolean" },
              archiveReversal: { type: "boolean" },
              protectedCorrespondent: { type: "boolean" },
              activeConversation: { type: "boolean" },
              requestedWork: { type: "boolean" },
              herbInitiated: { type: "boolean" },
            },
          },
          delegatedCustomer: {
            type: "object",
            additionalProperties: false,
            required: ["customerInquiry", "otherDevResultsRecipient", "requiresHerbAction"],
            properties: {
              customerInquiry: { type: "boolean" },
              otherDevResultsRecipient: { type: "boolean" },
              requiresHerbAction: { type: "boolean" },
            },
          },
          promotionCorrections: {
            type: "array",
            maxItems: 20,
            items: { $ref: "#/$defs/promotionCorrection" },
          },
        },
      },
    },
  },
  $defs: {
    mailbox: {
      type: "object",
      additionalProperties: false,
      required: ["name", "address"],
      properties: {
        name: { type: "string", maxLength: 500 },
        address: { type: "string", minLength: 3, maxLength: 320 },
      },
    },
    threadMessage: {
      type: "object",
      additionalProperties: false,
      required: ["receivedAt", "sender", "recipients", "subject", "body"],
      properties: {
        receivedAt: { type: "string", minLength: 1, maxLength: 100 },
        sender: { $ref: "#/$defs/mailbox" },
        recipients: {
          type: "array",
          maxItems: 100,
          items: { $ref: "#/$defs/mailbox" },
        },
        subject: { type: "string", maxLength: 2_000 },
        body: { type: "string", maxLength: 100_000 },
      },
    },
    promotionCorrection: {
      type: "object",
      additionalProperties: false,
      required: [
        "timestamp",
        "correction",
        "sender",
        "subject",
        "exactSender",
        "priorClassification",
        "priorReason",
        "priorPolicySignals",
      ],
      properties: {
        timestamp: { type: "string", maxLength: 100 },
        correction: { enum: ["promotion-reversed", "promotion-missed"] },
        sender: { $ref: "#/$defs/mailbox" },
        subject: { type: "string", maxLength: 2_000 },
        exactSender: { type: "boolean" },
        priorClassification: { type: "string", minLength: 1, maxLength: 200 },
        priorReason: { type: "string", maxLength: 2_000 },
        priorPolicySignals: {
          type: "array",
          maxItems: 50,
          items: { type: "string", maxLength: 200 },
        },
      },
    },
  },
} as const satisfies JsonSchema
