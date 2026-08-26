import { describe, expect, it } from "vitest"
import { MAX_ACTIONS_PER_RUN } from "../constants.ts"
import { downgradeIneligibleActions, validateClassifications } from "../validateClassifications.ts"
import {
  archiveProtectionFields,
  promotableCategories,
  validArchiveOutput,
  validClassifierInput,
  validNoneOutput,
  validPromoteOutput,
} from "./classifierFixtures.ts"

describe("validateClassifications", () => {
  it.each(archiveProtectionFields)("vetoes unwanted-mail archive when %s is true", protection => {
    const candidate = {
      ...validClassifierInput.candidates[0],
      archiveProtections: {
        ...validClassifierInput.candidates[0].archiveProtections,
        [protection]: true,
      },
    }

    expect(() =>
      validateClassifications(
        { ...validClassifierInput, candidates: [candidate] },
        validArchiveOutput,
      ),
    ).toThrow("Archive decision is blocked")
  })

  it("vetoes a DevResults sender even when its computed protection flag is wrong", () => {
    const candidate = {
      ...validClassifierInput.candidates[0],
      sender: { name: "Coworker", address: "coworker@devresults.com" },
    }

    expect(() =>
      validateClassifications(
        { ...validClassifierInput, candidates: [candidate] },
        validArchiveOutput,
      ),
    ).toThrow("Archive decision is blocked")
  })

  it("allows prior correspondence for a delegated customer inquiry", () => {
    const candidate = {
      ...validClassifierInput.candidates[0],
      archiveProtections: {
        ...validClassifierInput.candidates[0].archiveProtections,
        priorReply: true,
      },
      delegatedCustomer: {
        customerInquiry: true,
        otherDevResultsRecipient: true,
        requiresHerbAction: false,
      },
    }
    const output = {
      decisions: [
        {
          ...validArchiveOutput.decisions[0],
          classification: "delegated-customer",
          reason: "A colleague received the customer inquiry and Herb was not asked to act.",
        },
      ],
    }

    expect(
      validateClassifications({ ...validClassifierInput, candidates: [candidate] }, output),
    ).toEqual([
      {
        ...output.decisions[0],
        threadId: "thread-1",
        mutation: {
          addLabelIds: [],
          removeLabelIds: ["INBOX"],
        },
      },
    ])
  })

  it.each([
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])(
    "rejects delegated-customer archive without exact eligibility facts",
    (customerInquiry, otherDevResultsRecipient, requiresHerbAction) => {
      const candidate = {
        ...validClassifierInput.candidates[0],
        delegatedCustomer: { customerInquiry, otherDevResultsRecipient, requiresHerbAction },
      }
      const output = {
        decisions: [{ ...validArchiveOutput.decisions[0], classification: "delegated-customer" }],
      }

      expect(() =>
        validateClassifications({ ...validClassifierInput, candidates: [candidate] }, output),
      ).toThrow("Delegated customer archive is not eligible")
    },
  )

  it.each(promotableCategories)(
    "promotes a message from %s with the exact label delta",
    category => {
      const candidate = { ...validClassifierInput.candidates[0], category }

      expect(
        validateClassifications(
          { ...validClassifierInput, candidates: [candidate] },
          validPromoteOutput,
        ),
      ).toEqual([
        {
          ...validPromoteOutput.decisions[0],
          threadId: "thread-1",
          mutation: {
            addLabelIds: ["CATEGORY_PERSONAL"],
            removeLabelIds: [
              "CATEGORY_UPDATES",
              "CATEGORY_PROMOTIONS",
              "CATEGORY_SOCIAL",
              "CATEGORY_FORUMS",
            ],
          },
        },
      ])
    },
  )

  it.each(promotableCategories)(
    "rejects misfiled-marketing archive for a message in %s",
    category => {
      const candidate = { ...validClassifierInput.candidates[0], category }
      const output = {
        decisions: [{ ...validArchiveOutput.decisions[0], classification: "misfiled-marketing" }],
      }

      expect(() =>
        validateClassifications({ ...validClassifierInput, candidates: [candidate] }, output),
      ).toThrow("Misfiled marketing archive is not eligible")
    },
  )

  it("allows misfiled-marketing archive for a message in Primary", () => {
    const output = {
      decisions: [{ ...validArchiveOutput.decisions[0], classification: "misfiled-marketing" }],
    }

    expect(validateClassifications(validClassifierInput, output)[0]?.mutation).toEqual({
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    })
  })

  it("rejects promotion for a message already in Primary", () => {
    expect(() => validateClassifications(validClassifierInput, validPromoteOutput)).toThrow(
      "Promotion is not eligible",
    )
  })

  it("downgrades an ineligible action to a deterministic no-action decision", () => {
    expect(downgradeIneligibleActions(validClassifierInput, validPromoteOutput)).toEqual({
      decisions: [
        {
          messageId: "message-1",
          decision: "none",
          classification: "no-action",
          confidence: "high",
          reason: "Supervisor rejected an ineligible Gmail action.",
          policySignals: ["supervisor-veto"],
        },
      ],
    })
  })

  it("returns no mutation for a no-action decision", () => {
    expect(validateClassifications(validClassifierInput, validNoneOutput)).toEqual([
      {
        ...validNoneOutput.decisions[0],
        threadId: "thread-1",
        mutation: null,
      },
    ])
  })

  it("rejects an unknown candidate ID", () => {
    const output = {
      decisions: [{ ...validArchiveOutput.decisions[0], messageId: "not-offered" }],
    }

    expect(() => validateClassifications(validClassifierInput, output)).toThrow(
      "Unknown candidate message ID",
    )
  })

  it("rejects duplicate or missing candidate decisions", () => {
    const candidates = [
      validClassifierInput.candidates[0],
      {
        ...validClassifierInput.candidates[0],
        messageId: "message-2",
        threadId: "thread-2",
      },
    ]
    const duplicateOutput = {
      decisions: [validNoneOutput.decisions[0], validNoneOutput.decisions[0]],
    }

    expect(() =>
      validateClassifications({ ...validClassifierInput, candidates }, duplicateOutput),
    ).toThrow("Duplicate classifier decision")
    expect(() =>
      validateClassifications({ ...validClassifierInput, candidates }, validNoneOutput),
    ).toThrow("Missing classifier decision")
  })

  it.each([
    ["archive", "promote"],
    ["archive", "none"],
    ["promote", "none"],
  ] as const)("rejects %s and %s decisions for candidates in one thread", (first, second) => {
    const candidates = [
      {
        ...validClassifierInput.candidates[0],
        category: first === "promote" ? "updates" : "primary",
      },
      {
        ...validClassifierInput.candidates[0],
        messageId: "message-2",
        category: second === "promote" ? "updates" : "primary",
      },
    ]
    const decisionByAction = {
      archive: validArchiveOutput.decisions[0],
      promote: validPromoteOutput.decisions[0],
      none: validNoneOutput.decisions[0],
    }
    const decisions = [
      decisionByAction[first],
      { ...decisionByAction[second], messageId: "message-2" },
    ]

    expect(() =>
      validateClassifications({ ...validClassifierInput, candidates }, { decisions }),
    ).toThrow("Conflicting classifier actions for thread ID: thread-1")
  })

  it("rejects a batch above the conservative action limit", () => {
    const candidates = Array.from({ length: MAX_ACTIONS_PER_RUN + 1 }, (_, index) => ({
      ...validClassifierInput.candidates[0],
      messageId: `message-${index}`,
      threadId: `thread-${index}`,
    }))
    const decisions = candidates.map(candidate => ({
      ...validArchiveOutput.decisions[0],
      messageId: candidate.messageId,
    }))

    expect(() =>
      validateClassifications({ ...validClassifierInput, candidates }, { decisions }),
    ).toThrow(`Action limit of ${MAX_ACTIONS_PER_RUN} exceeded`)
  })
})
