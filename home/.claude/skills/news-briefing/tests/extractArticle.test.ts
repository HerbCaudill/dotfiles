import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const scriptPath = resolve(process.cwd(), "home/.claude/skills/news-briefing/extract_article.ts")

describe("extract_article.ts", () => {
  test("prefers article content and filters out short paragraphs", () => {
    const output = execFileSync("node", [scriptPath], {
      encoding: "utf8",
      input: `
        <html>
          <body>
            <p>This outside paragraph is long enough to be ignored because article content exists and should win.</p>
            <article>
              <p>Too short.</p>
              <p>The first article paragraph is long enough to keep, even after tags are removed from the extracted content.</p>
              <p>The second article paragraph is also long enough to keep and should appear on its own output line.</p>
            </article>
          </body>
        </html>
      `,
    })

    expect(output.trim().split("\n")).toEqual([
      "The first article paragraph is long enough to keep, even after tags are removed from the extracted content.",
      "The second article paragraph is also long enough to keep and should appear on its own output line.",
    ])
  })

  test("stops after the accumulated output crosses the article cap", () => {
    const paragraphs = Array.from({ length: 5 }, (_, index) => {
      const label = `Paragraph ${index + 1}`
      return `<p>${label} ${"x".repeat(995 - label.length)}</p>`
    }).join("")

    const output = execFileSync("node", [scriptPath], {
      encoding: "utf8",
      input: `<article>${paragraphs}</article>`,
    })

    expect(output.trim().split("\n")).toHaveLength(4)
    expect(output).toContain("Paragraph 4")
    expect(output).not.toContain("Paragraph 5")
  })
})
