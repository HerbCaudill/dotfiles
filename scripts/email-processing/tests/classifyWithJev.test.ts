import { describe, expect, it } from "vitest"
import { classifyWithJev } from "../classifyWithJev.ts"
import type { ClassifierCandidate } from "../types.ts"
import { validClassifierInput } from "./classifierFixtures.ts"

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
    const candidate = validClassifierInput.candidates[0] as ClassifierCandidate

    const result = await classifyWithJev(
      { candidate, evaluatedAt: "2026-11-06T12:00:00.000Z", listId: "", listUnsubscribe: true },
      { apiKey: "test-key", fetch },
    )

    const [request] = requests
    expect(request.url).toBe("https://api.typesafe.ai/v1/systemone")
    expect(request.headers.get("authorization")).toBe("Bearer test-key")
    expect(Object.keys(request.body.questions)).toEqual([
      "mail_kind",
      "cold_type",
      "needs_attention",
      "attention_reason",
      "routine_authentication",
    ])
    expect(request.body.state.message.subject).toBe(candidate.subject)
    expect(request.body.state.message.bulkMail).toEqual({ listUnsubscribe: true, listId: "" })
    // Protections are applied by code, so Jev never sees them.
    expect(JSON.stringify(request.body.state)).not.toContain("archiveProtections")
    expect(result.inputTokens).toBe(1200)
    expect(result.answers.mail_kind.type).toBe("choice")
  })
})
