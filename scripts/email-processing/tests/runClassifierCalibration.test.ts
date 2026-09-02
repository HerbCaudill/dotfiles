import { describe, expect, it, vi } from "vitest"

import { runClassifierCalibration } from "../runClassifierCalibration.ts"
import type { ClassifierInput, ClassifierOutput } from "../types.ts"

describe("runClassifierCalibration", () => {
  it("checks the complete synthetic decision matrix without accessing Gmail", async () => {
    const classify = vi.fn(
      async (input: ClassifierInput): Promise<ClassifierOutput> => ({
        decisions: input.candidates.map(candidate => ({
          messageId: candidate.messageId,
          decision: expectedDecision(candidate.messageId),
          classification:
            expectedDecision(candidate.messageId) === "archive"
              ? "delegated-customer"
              : expectedDecision(candidate.messageId) === "promote"
                ? "account-security"
                : "no-action",
          confidence: expectedDecision(candidate.messageId) === "archive" ? "high" : "medium",
          reason: "Synthetic calibration decision.",
          policySignals: ["routine"],
        })) as ClassifierOutput["decisions"],
      }),
    )

    await expect(
      runClassifierCalibration(classify, {
        evaluatedAt: "2026-09-02T10:00:00.000Z",
        policyVersion: `sha256:${"a".repeat(64)}`,
      }),
    ).resolves.toBe(8)

    expect(classify).toHaveBeenCalledOnce()
    expect(classify.mock.calls[0]?.[0]).toMatchObject({
      evaluatedAt: "2026-09-02T10:00:00.000Z",
      policyVersion: `sha256:${"a".repeat(64)}`,
      candidates: expect.arrayContaining([
        expect.objectContaining({ messageId: "routine-verification-code" }),
        expect.objectContaining({ messageId: "stale-operational-digest" }),
        expect.objectContaining({ messageId: "same-purpose-after-reversal" }),
      ]),
    })
  })

  it("reports only the identifiers of mismatched synthetic cases", async () => {
    await expect(
      runClassifierCalibration(
        async input => ({
          decisions: input.candidates.map(candidate => ({
            messageId: candidate.messageId,
            decision: "none",
            classification: "no-action",
            confidence: "high",
            reason: "Synthetic mismatch.",
            policySignals: ["routine"],
          })),
        }),
        {
          evaluatedAt: "2026-09-02T10:00:00.000Z",
          policyVersion: `sha256:${"a".repeat(64)}`,
        },
      ),
    ).rejects.toThrow(/fresh-security-incident/)
  })
})

/** Return the exact synthetic outcome expected for one calibration case. */
function expectedDecision(
  /** Synthetic message ID. */
  messageId: string,
): "archive" | "promote" | "none" {
  if (messageId === "delegated-customer") return "archive"
  if (
    [
      "fresh-security-incident",
      "fresh-operational-failure",
      "different-critical-event-after-reversal",
      "delegated-customer-requires-herb",
    ].includes(messageId)
  ) {
    return "promote"
  }
  return "none"
}
