import { describe, expect, it } from "vitest"
import { classifierOutputJsonSchema } from "../classifierOutputJsonSchema.ts"
import { parseClassifierOutput } from "../parseClassifierOutput.ts"
import { validateJsonSchema } from "../validateJsonSchema.ts"
import {
  archiveClassifications,
  promoteClassifications,
  validArchiveOutput,
  validNoneOutput,
  validPromoteOutput,
} from "./classifierFixtures.ts"

describe("parseClassifierOutput", () => {
  it.each([validArchiveOutput, validPromoteOutput, validNoneOutput])(
    "accepts a strict decision variant",
    output => {
      expect(parseClassifierOutput(output)).toEqual(output)
    },
  )

  it("rejects an arbitrary action", () => {
    const output = {
      decisions: [{ ...validArchiveOutput.decisions[0], decision: "delete" }],
    }

    expect(() => parseClassifierOutput(output)).toThrow("$.decisions[0]")
  })

  it.each([
    ["command", "gws gmail users.messages.trash"],
    ["addLabels", ["STARRED"]],
    ["removeLabels", ["IMPORTANT"]],
  ])("rejects the extra classifier field %s", (field, value) => {
    const output = {
      decisions: [{ ...validArchiveOutput.decisions[0], [field]: value }],
    }

    expect(() => parseClassifierOutput(output)).toThrow(`$.decisions[0].${field}`)
  })

  it("rejects a low-confidence archive decision", () => {
    const output = {
      decisions: [{ ...validArchiveOutput.decisions[0], confidence: "low" }],
    }

    expect(() => parseClassifierOutput(output)).toThrow("$.decisions[0]")
  })

  it("rejects a low-confidence promotion decision", () => {
    const output = {
      decisions: [{ ...validPromoteOutput.decisions[0], confidence: "low" }],
    }

    expect(() => parseClassifierOutput(output)).toThrow("$.decisions[0]")
  })

  it("encodes decision-specific confidence and classification rules in the exported schema", () => {
    const output = {
      decisions: [{ ...validArchiveOutput.decisions[0], confidence: "medium" }],
    }

    expect(() => validateJsonSchema(output, classifierOutputJsonSchema)).toThrow("$.decisions[0]")
  })

  it.each(archiveClassifications)("accepts the archive classification %s", classification => {
    const output = {
      decisions: [{ ...validArchiveOutput.decisions[0], classification }],
    }

    expect(parseClassifierOutput(output)).toEqual(output)
  })

  it.each(promoteClassifications)("accepts the promotion classification %s", classification => {
    const output = {
      decisions: [{ ...validPromoteOutput.decisions[0], classification }],
    }

    expect(parseClassifierOutput(output)).toEqual(output)
  })
})
