import { describe, expect, test } from "vitest"

import { getVisibleToolResultText } from "../getVisibleToolResultText.ts"

/** A tool result content part used by the renderer helpers. */
type ToolContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string }

/** A minimal tool result shape used by the renderer helpers. */
type ToolResultLike = {
  content: ToolContentPart[]
}

describe("getVisibleToolResultText", () => {
  test("returns an empty string while collapsed", () => {
    const result: ToolResultLike = {
      content: [{ type: "text", text: "alpha\nbeta" }],
    }

    expect(getVisibleToolResultText(result, { expanded: false })).toBe("")
  })

  test("shows the first text payload when expanded", () => {
    const result: ToolResultLike = {
      content: [{ type: "text", text: "alpha\nbeta" }],
    }

    expect(getVisibleToolResultText(result, { expanded: true })).toBe("\nalpha\nbeta")
  })

  test("can trim expanded output for bash-style results", () => {
    const result: ToolResultLike = {
      content: [{ type: "text", text: "\nalpha\nbeta\n" }],
    }

    expect(getVisibleToolResultText(result, { expanded: true, trim: true })).toBe("\nalpha\nbeta")
  })

  test("returns an empty string when no text payload exists", () => {
    const result: ToolResultLike = {
      content: [{ type: "image", mimeType: "image/png", data: "abc" }],
    }

    expect(getVisibleToolResultText(result, { expanded: true })).toBe("")
  })
})
