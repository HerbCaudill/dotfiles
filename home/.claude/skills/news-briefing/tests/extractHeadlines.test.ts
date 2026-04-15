import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const scriptPath = resolve(process.cwd(), "home/.claude/skills/news-briefing/extract_headlines.ts")

describe("extract_headlines.ts", () => {
  test("extracts heading links from nested anchors, parent anchors, and aria-label stretched links", () => {
    const output = execFileSync("node", [scriptPath, "https://example.com/world/"], {
      encoding: "utf8",
      input: `
        <html>
          <body>
            <h2><a href="/story-1">Inside anchor headline with enough words to be kept</a></h2>
            <a href="/story-2"><h3>Parent anchor headline with enough words to be kept</h3></a>
            <a href="/story-3" aria-label="Stretched link headline with enough words to be kept"></a>
            <h3>Stretched link headline with enough words to be kept</h3>
            <h2>Too short</h2>
            <h2><a href="/story-1">Inside anchor headline with enough words to be kept</a></h2>
          </body>
        </html>
      `,
    })

    expect(output.trim().split("\n")).toEqual([
      "https://example.com/story-1 | Inside anchor headline with enough words to be kept",
      "https://example.com/story-2 | Parent anchor headline with enough words to be kept",
      "https://example.com/story-3 | Stretched link headline with enough words to be kept",
    ])
  })
})
