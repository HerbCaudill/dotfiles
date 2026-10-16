import { expect, test } from "vitest"
import { stripBinaryContent } from "../stripBinaryContent.ts"

test("retains conversation and tool text while replacing embedded images with a readable marker", () => {
  const record = {
    message: {
      content: [
        { type: "text", text: "Look at this screenshot" },
        { type: "image", source: { type: "base64", data: "aGVsbG8=" } },
        {
          type: "tool_result",
          content: JSON.stringify([
            { type: "text", text: "Build passed" },
            { type: "image", data: "aGVsbG8=" },
          ]),
        },
      ],
    },
  }
  const result = stripBinaryContent(record) as typeof record
  expect(result.message.content[0]).toEqual({ type: "text", text: "Look at this screenshot" })
  expect(result.message.content[1]).toEqual({
    type: "text",
    text: "[Image omitted from shared text archive; available in the original transcript.]",
  })
  expect(JSON.parse(result.message.content[2].content!)[0]).toEqual({
    type: "text",
    text: "Build passed",
  })
  expect(JSON.parse(result.message.content[2].content!)[1].text).toContain("Image omitted")
})
