import { describe, expect, it } from "vitest"
import { validateLabelMutation } from "../validateLabelMutation.ts"

describe("validateLabelMutation", () => {
  it.each([
    {
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    },
    {
      addLabelIds: ["CATEGORY_PERSONAL"],
      removeLabelIds: [
        "CATEGORY_UPDATES",
        "CATEGORY_PROMOTIONS",
        "CATEGORY_SOCIAL",
        "CATEGORY_FORUMS",
      ],
    },
  ])("accepts one exact authorized mutation", mutation => {
    expect(validateLabelMutation(mutation)).toEqual(mutation)
  })

  it.each([
    { addLabelIds: ["STARRED"], removeLabelIds: [] },
    { addLabelIds: [], removeLabelIds: ["TRASH"] },
    { addLabelIds: ["CATEGORY_PERSONAL"], removeLabelIds: ["CATEGORY_UPDATES"] },
    { addLabelIds: [], removeLabelIds: ["INBOX", "IMPORTANT"] },
  ])("rejects every other label delta", mutation => {
    expect(() => validateLabelMutation(mutation)).toThrow("Unauthorized Gmail label mutation")
  })
})
