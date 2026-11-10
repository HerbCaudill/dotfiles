import { describe, expect, it } from "vitest"
import { applyCorrectionUpdates, dispositionOf, emptyCorrectionStore } from "../jevCorrections.ts"
import type { JevDecision } from "../decideFromJevAnswers.ts"
import type { ClassifiedRecord } from "../renderJevDryRunReport.ts"

describe("dispositionOf", () => {
  it("reads unsubscribing as the strongest disposition", () => {
    expect(dispositionOf(decision("archive", true))).toBe("unsubscribe")
    expect(dispositionOf(decision("archive", false))).toBe("archive")
    expect(dispositionOf(decision("promote", false))).toBe("promote")
    expect(dispositionOf(decision("none", false))).toBe("leave")
  })
})

describe("applyCorrectionUpdates", () => {
  const records = new Map([["m1", record("m1")]])
  const context = { run: "dry-run-2026-11-06", now: "2026-11-10T09:00:00.000Z" }

  it("records Herb's disposition with what Jev said and enough context to read it later", () => {
    const store = applyCorrectionUpdates(
      emptyCorrectionStore(),
      [{ messageId: "m1", disposition: "archive", note: "I never read these" }],
      records,
      context,
    )

    expect(store.corrections.m1).toEqual({
      disposition: "archive",
      note: "I never read these",
      jevDisposition: "leave",
      sender: { name: "Example", address: "news@example.com" },
      subject: "Weekly digest",
      receivedAt: "2026-11-05T10:00:00.000Z",
      gmailUrl: "https://mail.google.com/mail/#all/m1",
      run: "dry-run-2026-11-06",
      updatedAt: "2026-11-10T09:00:00.000Z",
    })
    expect(store.updatedAt).toBe("2026-11-10T09:00:00.000Z")
  })

  it("keeps the existing note when only the disposition changes", () => {
    const first = applyCorrectionUpdates(
      emptyCorrectionStore(),
      [{ messageId: "m1", disposition: "archive", note: "customer" }],
      records,
      context,
    )
    const second = applyCorrectionUpdates(
      first,
      [{ messageId: "m1", disposition: "leave" }],
      records,
      context,
    )

    expect(second.corrections.m1.disposition).toBe("leave")
    expect(second.corrections.m1.note).toBe("customer")
  })

  it("treats a note without a disposition as agreeing with Jev", () => {
    const store = applyCorrectionUpdates(
      emptyCorrectionStore(),
      [{ messageId: "m1", note: "fine as is" }],
      records,
      context,
    )

    expect(store.corrections.m1.disposition).toBe("leave")
  })

  it("removes a correction when the disposition is cleared", () => {
    const first = applyCorrectionUpdates(
      emptyCorrectionStore(),
      [{ messageId: "m1", disposition: "archive" }],
      records,
      context,
    )
    const second = applyCorrectionUpdates(
      first,
      [{ messageId: "m1", disposition: null }],
      records,
      context,
    )

    expect(second.corrections).toEqual({})
  })

  it("rejects unknown messages and dispositions", () => {
    expect(() =>
      applyCorrectionUpdates(
        emptyCorrectionStore(),
        [{ messageId: "nope", disposition: "archive" }],
        records,
        context,
      ),
    ).toThrow(/Unknown message/)
    expect(() =>
      applyCorrectionUpdates(
        emptyCorrectionStore(),
        [{ messageId: "m1", disposition: "delete" as never }],
        records,
        context,
      ),
    ).toThrow(/Unknown disposition/)
  })
})

/** Build a decision. */
function decision(
  /** Label action. */
  action: JevDecision["decision"],
  /** Whether unsubscribing is eligible. */
  unsubscribe: boolean,
): JevDecision {
  return {
    mailKind: "marketing",
    decision: action,
    classification: "no-action",
    unsubscribe: { eligible: unsubscribe, blockedBy: [] },
  }
}

/** Build a classified record that Jev would leave alone. */
function record(
  /** Message ID. */
  messageId: string,
) {
  return {
    messageId,
    gmailUrl: `https://mail.google.com/mail/#all/${messageId}`,
    receivedAt: "2026-11-05T10:00:00.000Z",
    sender: { name: "Example", address: "news@example.com" },
    subject: "Weekly digest",
    decision: decision("none", false),
  } as ClassifiedRecord
}
