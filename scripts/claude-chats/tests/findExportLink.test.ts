import { describe, expect, it } from "vitest"
import { findExportLink } from "../findExportLink.ts"

const link =
  "https://claude.ai/export/a49e93db-55fc-4df1-96c3-780684ca7567/download/d934477264dc643f"

describe("findExportLink", () => {
  it("finds the download link in an email from Anthropic", () => {
    const body = `Download data[](${link}) Help[](https://url8792.mail.anthropic.com/ls/click)`

    expect(findExportLink("no-reply-abc@mail.anthropic.com", body)).toBe(link)
  })

  it("rejects a matching link from any other sender", () => {
    expect(findExportLink("no-reply@mail.anthropic.com.evil.test", link)).toBeNull()
  })

  it("rejects an email with no export link", () => {
    const body = "Download data https://evil.test/export/x/download/y"

    expect(findExportLink("no-reply@mail.anthropic.com", body)).toBeNull()
  })
})
