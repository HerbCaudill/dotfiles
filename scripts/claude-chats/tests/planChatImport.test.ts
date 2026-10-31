import { describe, expect, it } from "vitest"
import { planChatImport } from "../planChatImport.ts"
import type { Conversation, ExistingChat } from "../planChatImport.ts"

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  uuid: "11111111-aaaa-4aaa-8aaa-111111111111",
  name: "Salvaging melted ice cream",
  created_at: "2026-03-02T10:00:00Z",
  updated_at: "2026-03-02T10:05:00Z",
  chat_messages: [
    { sender: "human", text: "Can I refreeze it?" },
    { sender: "assistant", content: [{ type: "text", text: "Probably not." }] },
  ],
  ...overrides,
})

/** Build the vault's view of a chat from a previous import of the same conversation. */
const existing = (source: Conversation): ExistingChat[] =>
  planChatImport([source], []).writes.map(({ fileName, content }) => ({
    fileName,
    content,
    uuid: source.uuid,
  }))

describe("planChatImport", () => {
  it("creates a dated Markdown file for a new chat", () => {
    const { writes } = planChatImport([conversation()], [])

    expect(writes).toHaveLength(1)
    expect(writes[0].fileName).toBe("20260302-salvaging-melted-ice-cream.md")
    expect(writes[0].content).toContain("claude_chat_uuid: 11111111-aaaa-4aaa-8aaa-111111111111")
    expect(writes[0].content).toContain("## Herb\n\nCan I refreeze it?")
    expect(writes[0].content).toContain("## Claude\n\nProbably not.")
  })

  it("leaves an unchanged chat alone", () => {
    const source = conversation()

    expect(planChatImport([source], existing(source)).writes).toEqual([])
  })

  it("updates a renamed chat in its existing file", () => {
    const source = conversation()
    const renamed = conversation({ name: "Ice cream", updated_at: "2026-03-03T10:00:00Z" })

    const { writes } = planChatImport([renamed], existing(source))

    expect(writes).toHaveLength(1)
    expect(writes[0].fileName).toBe("20260302-salvaging-melted-ice-cream.md")
    expect(writes[0].content).toContain('title: "Ice cream"')
  })

  it("gives two new chats with the same name and date different files", () => {
    const second = conversation({ uuid: "22222222-bbbb-4bbb-8bbb-222222222222" })

    const fileNames = planChatImport([conversation(), second], []).writes.map(w => w.fileName)

    expect(new Set(fileNames).size).toBe(2)
  })

  it("does not reuse the file name of a chat missing from the export", () => {
    const earlier = conversation({ uuid: "22222222-bbbb-4bbb-8bbb-222222222222" })

    const { writes } = planChatImport([conversation()], existing(earlier))

    expect(writes[0].fileName).not.toBe("20260302-salvaging-melted-ice-cream.md")
  })

  it("skips a chat with no content", () => {
    const blank = conversation({ chat_messages: [{ sender: "human", text: "", content: [] }] })

    expect(planChatImport([blank], [])).toEqual({ writes: [], skipped: 1 })
  })

  it("keeps speech and file names but drops thinking and tool activity", () => {
    const source = conversation({
      chat_messages: [
        {
          sender: "assistant",
          content: [
            { type: "thinking", text: "private reasoning" },
            { type: "tool_result", text: "tool output" },
            { type: "text", text: "Visible answer" },
          ],
          files: [{ file_name: "photo.jpeg" }],
        },
      ],
    })

    const { content } = planChatImport([source], []).writes[0]

    expect(content).toContain("Visible answer")
    expect(content).toContain("_Files: photo.jpeg_")
    expect(content).not.toContain("private reasoning")
    expect(content).not.toContain("tool output")
  })
})
