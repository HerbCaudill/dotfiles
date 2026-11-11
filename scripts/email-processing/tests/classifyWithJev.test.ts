import { describe, expect, it } from "vitest"
import { classifyWithJev } from "../classifyWithJev.ts"
import type { ClassifierCandidate } from "../types.ts"

describe("classifyWithJev", () => {
  it("asks Jev the policy questions about the message and returns its answers", async () => {
    const requests: { url: string; headers: Headers; body: any }[] = []
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      })
      return Response.json({
        model: "jev-1.14.0",
        answers: { mail_kind: { type: "choice" } },
        usage: { input_tokens: 1200 },
      })
    }

    const result = await classifyWithJev(
      { candidate, evaluatedAt: "2026-11-06T12:00:00.000Z" },
      { apiKey: "test-key", fetch },
    )

    const [request] = requests
    expect(request.url).toBe("https://api.typesafe.ai/v1/systemone")
    expect(request.headers.get("authorization")).toBe("Bearer test-key")
    expect(Object.keys(request.body.questions)).toEqual([
      "mail_kind",
      "cold_type",
      "keep_in_inbox",
      "attention_reason",
      "routine_authentication",
    ])
    expect(request.body.state.message.subject).toBe(candidate.subject)
    expect(request.body.state.message.bulkMail).toEqual({
      listUnsubscribe: true,
      listId: "<news.example.com>",
    })
    // Protections, labels and calendar facts are applied by code, so Jev never sees them.
    const state = JSON.stringify(request.body.state)
    expect(state).not.toContain("archiveProtections")
    expect(state).not.toContain("keepLabeled")
    expect(state).not.toContain("https://unsubscribe.example.com")
    expect(result.inputTokens).toBe(1200)
    expect(result.answers.mail_kind.type).toBe("choice")
  })
})

const candidate: ClassifierCandidate = {
  messageId: "message-1",
  threadId: "thread-1",
  receivedAt: "2026-11-06T11:00:00.000Z",
  sender: { name: "News", address: "news@example.com" },
  recipients: [{ name: "Herb Caudill", address: "herb@devresults.com" }],
  subject: "This week's offers",
  body: "Save 20% this week.",
  thread: [],
  category: "promotions",
  archiveProtections: {
    priorReply: false,
    archiveReversal: false,
    activeConversation: false,
    requestedWork: false,
    herbInitiated: false,
  },
  bulkMail: {
    listId: "<news.example.com>",
    listUnsubscribe: true,
    oneClickUnsubscribeUrl: "https://unsubscribe.example.com/u/1",
  },
  calendarMethod: null,
  autoReply: false,
  keepLabeled: false,
}
