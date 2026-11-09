import { describe, expect, it } from "vitest"
import { renderHtmlReport } from "../renderJevDryRunHtml.ts"
import type { DryRun } from "../renderJevDryRunReport.ts"

describe("renderHtmlReport", () => {
  it("embeds every subject line as data that the page can read back", () => {
    const subject = `Your order </script><script>alert(1)</script> & more`
    const html = renderHtmlReport(dryRunWith(subject))

    const embedded = html.match(
      /<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/,
    )
    expect(embedded).not.toBeNull()
    const data = JSON.parse(embedded![1])
    expect(data.records.map((record: { subject: string }) => record.subject)).toEqual([subject])
    expect(data.summary.threads).toBe(1)
  })
})

/** Build a one-thread dry run with the given subject. */
function dryRunWith(
  /** Subject line. */
  subject: string,
): DryRun {
  return {
    createdAt: "2026-11-06T16:08:42.476Z",
    windowDays: 30,
    account: "herb@devresults.com",
    questionsVersion: "sha256:test",
    labelsSource: null,
    receivedMessages: 1,
    threads: 1,
    records: [
      {
        messageId: "m1",
        threadId: "t1",
        gmailUrl: "https://mail.google.com/mail/#all/t1",
        labelIds: ["INBOX"],
        listId: "",
        oneClickUnsubscribe: true,
        receivedAt: "2026-11-05T10:00:00.000Z",
        sender: { name: "Shop", address: "news@shop.example" },
        subject,
        category: "promotions",
        archiveProtections: { priorReply: false },
        jev: {
          model: "jev-1.14.0",
          inputTokens: 1000,
          latencyMs: 150,
          answers: {
            mail_kind: {
              type: "choice",
              choice: "marketing",
              confidence: 0.9,
              probabilities: { marketing: 0.95, transactional: 0.05 },
            },
            cold_type: {
              type: "choice",
              choice: "cold_vendor",
              confidence: 0.5,
              probabilities: { cold_vendor: 0.6 },
            },
            needs_attention: { type: "noul", noul: 0.1 },
            attention_reason: {
              type: "choice",
              choice: "active_work",
              confidence: 0.5,
              probabilities: { active_work: 0.5 },
            },
            routine_authentication: { type: "noul", noul: 0 },
          },
        },
        decision: {
          mailKind: "marketing",
          decision: "none",
          classification: "no-action",
          unsubscribe: { eligible: true, blockedBy: [] },
        },
        label: "marketing",
      },
    ],
  }
}
