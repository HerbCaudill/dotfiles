import { EMAIL_PROCESSING_ACCOUNT, PROMOTABLE_CATEGORIES } from "./constants.ts"
import type { JsonSchema } from "./types.ts"

/** Strict JSON Schema for normalized inert classifier input. */
export const classifierInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["account", "candidates"],
  properties: {
    account: { const: EMAIL_PROCESSING_ACCOUNT },
    candidates: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "messageId",
          "threadId",
          "sender",
          "recipients",
          "subject",
          "body",
          "thread",
          "category",
          "archiveProtections",
          "delegatedCustomer",
        ],
        properties: {
          messageId: { type: "string", minLength: 1, maxLength: 256 },
          threadId: { type: "string", minLength: 1, maxLength: 256 },
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
      required: ["sender", "recipients", "subject", "body"],
      properties: {
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
  },
} as const satisfies JsonSchema
