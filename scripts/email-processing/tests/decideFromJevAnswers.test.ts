import { describe, expect, it } from "vitest"
import {
  decideFromJevAnswers,
  type JevAnswers,
  type JevDecisionInput,
} from "../decideFromJevAnswers.ts"

describe("decideFromJevAnswers", () => {
  it("unsubscribes from clear marketing that offers one-click unsubscribe", () => {
    const result = decideFromJevAnswers(input({ answers: answers({ mailKind: "marketing" }) }))

    expect(result.mailKind).toBe("marketing")
    expect(result.unsubscribe).toEqual({ eligible: true, blockedBy: [] })
  })

  it("never unsubscribes from a devresults.com mailing list", () => {
    const result = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "marketing" }), listId: "<support.devresults.com>" }),
    )

    expect(result.unsubscribe.eligible).toBe(false)
    expect(result.unsubscribe.blockedBy).toContain("devresults-list")
  })

  it("does not unsubscribe when marketing is uncertain", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "marketing", probability: 0.6, runnerUp: "editorial" }),
      }),
    )

    expect(result.unsubscribe.eligible).toBe(false)
    expect(result.unsubscribe.blockedBy).toContain("not-marketing")
  })

  it("does not unsubscribe without a one-click unsubscribe header", () => {
    const result = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "marketing" }), oneClickUnsubscribe: false }),
    )

    expect(result.unsubscribe.blockedBy).toContain("no-one-click")
  })

  it("does not unsubscribe from a sender Herb has replied to", () => {
    const result = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "marketing" }), protections: { priorReply: true } }),
    )

    expect(result.unsubscribe.blockedBy).toContain("priorReply")
  })

  it("archives clear cold outreach with its pitch type", () => {
    const result = decideFromJevAnswers(input({ answers: answers({ mailKind: "cold_outreach" }) }))

    expect(result.decision).toBe("archive")
    expect(result.classification).toBe("cold-vendor")
  })

  it("does not archive cold outreach when a protection applies", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "cold_outreach" }),
        protections: { activeConversation: true },
      }),
    )

    expect(result.decision).toBe("none")
  })

  it("archives clear marketing in any category", () => {
    for (const category of ["primary", "promotions", "updates", "forums"] as const) {
      const result = decideFromJevAnswers(
        input({ answers: answers({ mailKind: "marketing" }), category }),
      )

      expect(result.decision).toBe("archive")
      expect(result.classification).toBe("marketing")
    }
  })

  it("archives marketing that it cannot unsubscribe from", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "marketing" }),
        oneClickUnsubscribe: false,
        protections: { devResultsSender: true, protectedCorrespondent: true, priorReply: true },
      }),
    )

    expect(result.unsubscribe.eligible).toBe(false)
    expect(result.decision).toBe("archive")
  })

  it("does not archive marketing from a sender whose archive Herb undid", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "marketing" }),
        protections: { archiveReversal: true },
      }),
    )

    expect(result.decision).toBe("none")
    expect(result.unsubscribe.blockedBy).toContain("archiveReversal")
  })

  it("does not archive uncertain marketing", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "marketing", probability: 0.6, runnerUp: "editorial" }),
      }),
    )

    expect(result.decision).toBe("none")
  })

  it("unsubscribes from marketing despite correspondent keywords", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "marketing" }),
        protections: { protectedCorrespondent: true },
      }),
    )

    expect(result.unsubscribe.eligible).toBe(true)
  })

  it("promotes a message outside Primary that needs attention", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "notification", needsAttention: 0.9 }),
        category: "updates",
      }),
    )

    expect(result.decision).toBe("promote")
    expect(result.classification).toBe("operational-failure")
  })

  it("does not promote a routine one-time code", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({
          mailKind: "transactional",
          needsAttention: 0.9,
          routineAuthentication: 0.95,
        }),
        category: "updates",
      }),
    )

    expect(result.decision).toBe("none")
  })
})

/** Build Jev answers peaked on one mail kind. */
function answers(
  /** Answer overrides. */
  options: {
    mailKind: string
    probability?: number
    runnerUp?: string
    needsAttention?: number
    routineAuthentication?: number
  },
): JevAnswers {
  const probability = options.probability ?? 0.97
  const probabilities = Object.fromEntries(MAIL_KINDS.map(kind => [kind, 0]))
  probabilities[options.mailKind] = probability
  probabilities[
    options.runnerUp ?? (options.mailKind === "personal" ? "notification" : "personal")
  ] = 1 - probability
  return {
    mail_kind: { type: "choice", choice: options.mailKind, confidence: probability, probabilities },
    cold_type: {
      type: "choice",
      choice: "cold_vendor",
      confidence: 0.9,
      probabilities: {
        cold_vendor: 0.95,
        cold_job_inquiry: 0.02,
        cold_investor: 0.02,
        generic_solicitation: 0.01,
      },
    },
    needs_attention: { type: "noul", noul: options.needsAttention ?? 0.05 },
    attention_reason: {
      type: "choice",
      choice: "operational_failure",
      confidence: 0.8,
      probabilities: { operational_failure: 0.9, explicit_action: 0.1 },
    },
    routine_authentication: { type: "noul", noul: options.routineAuthentication ?? 0.02 },
  }
}

/** Build a decision input with safe defaults. */
function input(
  /** Input overrides. */
  options: {
    answers: JevAnswers
    category?: JevDecisionInput["category"]
    listId?: string
    oneClickUnsubscribe?: boolean
    protections?: Partial<JevDecisionInput["archiveProtections"]>
  },
): JevDecisionInput {
  return {
    answers: options.answers,
    category: options.category ?? "promotions",
    senderAddress: "news@example.com",
    listId: options.listId ?? "",
    oneClickUnsubscribe: options.oneClickUnsubscribe ?? true,
    archiveProtections: {
      devResultsSender: false,
      priorReply: false,
      archiveReversal: false,
      protectedCorrespondent: false,
      activeConversation: false,
      requestedWork: false,
      herbInitiated: false,
      ...options.protections,
    },
  }
}

const MAIL_KINDS = [
  "personal",
  "cold_outreach",
  "marketing",
  "editorial",
  "transactional",
  "notification",
  "government",
]
