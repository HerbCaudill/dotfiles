import { describe, expect, it } from "vitest"
import {
  decideFromJevAnswers,
  type JevAnswers,
  type JevDecisionInput,
} from "../decideFromJevAnswers.ts"

describe("decideFromJevAnswers", () => {
  it("archives clear marketing and unsubscribes when it offers one-click unsubscribe", () => {
    const result = decideFromJevAnswers(input({ answers: answers({ mailKind: "marketing" }) }))

    expect(result.decision).toBe("archive")
    expect(result.classification).toBe("marketing")
    expect(result.unsubscribe).toEqual({ eligible: true, blockedBy: [] })
  })

  it("archives marketing it cannot unsubscribe from", () => {
    const withoutOneClick = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "marketing" }), oneClickUnsubscribe: false }),
    )
    const fromDevResultsList = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "marketing" }), listId: "<support.devresults.com>" }),
    )

    expect(withoutOneClick.decision).toBe("archive")
    expect(withoutOneClick.unsubscribe.blockedBy).toContain("no-one-click")
    expect(fromDevResultsList.decision).toBe("archive")
    expect(fromDevResultsList.unsubscribe.blockedBy).toContain("devresults-list")
  })

  it("archives marketing from a sender Herb replied to, but does not unsubscribe", () => {
    const result = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "marketing" }), protections: { priorReply: true } }),
    )

    expect(result.decision).toBe("archive")
    expect(result.unsubscribe.blockedBy).toContain("priorReply")
  })

  it("does not unsubscribe when marketing is uncertain", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "marketing", probability: 0.6, runnerUp: "editorial" }),
      }),
    )

    expect(result.unsubscribe.blockedBy).toContain("not-marketing")
  })

  it("keeps mail from a sender whose archive Herb undid", () => {
    const result = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "marketing" }),
        protections: { archiveReversal: true },
      }),
    )

    expect(result.decision).toBe("none")
    expect(result.unsubscribe.eligible).toBe(false)
  })

  it("archives by default, classified by mail kind", () => {
    const result = decideFromJevAnswers(input({ answers: answers({ mailKind: "transactional" }) }))

    expect(result.decision).toBe("archive")
    expect(result.classification).toBe("transactional")
    expect(result.unsubscribe.eligible).toBe(false)
  })

  it("archives cold outreach with its pitch type", () => {
    const result = decideFromJevAnswers(input({ answers: answers({ mailKind: "cold_outreach" }) }))

    expect(result.decision).toBe("archive")
    expect(result.classification).toBe("cold-vendor")
  })

  it("keeps what Jev says Herb keeps, promoting it when it is outside Primary", () => {
    const inPrimary = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "personal", keep: 0.9 }), category: "primary" }),
    )
    const inUpdates = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "notification", keep: 0.9 }), category: "updates" }),
    )

    expect(inPrimary.decision).toBe("none")
    expect(inPrimary.classification).toBe("keep")
    expect(inUpdates.decision).toBe("promote")
    expect(inUpdates.classification).toBe("operational-failure")
  })

  it("keeps calendar invitations and archives calendar replies whatever Jev says", () => {
    const invitation = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "notification", keep: 0.1 }),
        category: "primary",
        calendarMethod: "REQUEST",
      }),
    )
    const reply = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "notification", keep: 0.9 }),
        category: "primary",
        calendarMethod: "REPLY",
      }),
    )

    expect(invitation.decision).toBe("none")
    expect(invitation.classification).toBe("calendar-invitation")
    expect(reply.decision).toBe("archive")
    expect(reply.classification).toBe("calendar-reply")
  })

  it("keeps personal mail from someone Herb has written to, even when Jev would archive it", () => {
    const correspondent = decideFromJevAnswers(
      input({
        answers: answers({ mailKind: "personal", keep: 0.1 }),
        category: "primary",
        protections: { priorReply: true },
      }),
    )
    const stranger = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "personal", keep: 0.1 }), category: "primary" }),
    )

    expect(correspondent.decision).toBe("none")
    expect(correspondent.classification).toBe("correspondent")
    expect(stranger.decision).toBe("archive")
  })

  it("archives automatic replies whatever Jev says", () => {
    const result = decideFromJevAnswers(
      input({ answers: answers({ mailKind: "personal", keep: 0.9 }), autoReply: true }),
    )

    expect(result.decision).toBe("archive")
    expect(result.classification).toBe("auto-reply")
  })
})

/** Build Jev answers peaked on one mail kind. */
function answers(
  /** Answer overrides. */
  options: {
    mailKind: string
    probability?: number
    runnerUp?: string
    keep?: number
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
    keep_in_inbox: { type: "noul", noul: options.keep ?? 0.05 },
    attention_reason: {
      type: "choice",
      choice: "operational_failure",
      confidence: 0.8,
      probabilities: { operational_failure: 0.9, explicit_action: 0.1 },
    },
    routine_authentication: { type: "noul", noul: 0.02 },
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
    calendarMethod?: string | null
    autoReply?: boolean
    protections?: Partial<JevDecisionInput["archiveProtections"]>
  },
): JevDecisionInput {
  return {
    answers: options.answers,
    category: options.category ?? "promotions",
    senderAddress: "news@example.com",
    listId: options.listId ?? "",
    oneClickUnsubscribe: options.oneClickUnsubscribe ?? true,
    calendarMethod: options.calendarMethod ?? null,
    autoReply: options.autoReply ?? false,
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
