import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, test } from "vitest"

const scriptPath = resolve(
  process.cwd(),
  "home/.claude/skills/meeting-transcript/scripts/parseZoomTranscript.ts",
)

describe("parseZoomTranscript.ts", () => {
  test("parses frontmatter, participants, and merged Zoom speaker turns", () => {
    const directory = mkdtempSync(join(tmpdir(), "meeting-transcript-"))
    const transcriptPath = join(directory, "2026-06-15 13-00 - Amanda-Herb.md")

    writeFileSync(
      transcriptPath,
      `---
source: zoom
title: "Amanda:Herb"
source_created_at: 2026-06-15T13:00:20Z
---

[00:01:32.000] Amanda Pinkston: Hello.
[00:01:33.000] Herb Caudill: Hi, Amanda.
[00:01:34.000] Herb Caudill: I thought I would have something visual today.
[00:01:40.000] Amanda Pinkston: Okay.
[00:01:41.000] Brent Keller: Bye.
`,
    )

    const output = execFileSync("node", [scriptPath, transcriptPath], { encoding: "utf8" })
    const parsed = JSON.parse(output)

    expect(parsed).toMatchObject({
      sourcePath: transcriptPath,
      metadata: {
        source: "zoom",
        title: "Amanda:Herb",
        source_created_at: "2026-06-15T13:00:20Z",
      },
      participants: [
        { name: "Amanda Pinkston", displayName: "Amanda" },
        { name: "Herb Caudill", displayName: "Herb" },
        { name: "Brent Keller", displayName: "Brent" },
      ],
      turns: [
        {
          timestamp: "00:01:32.000",
          speaker: "Amanda",
          speakerLabel: "Amanda Pinkston",
          text: "Hello.",
        },
        {
          timestamp: "00:01:33.000",
          speaker: "Herb",
          speakerLabel: "Herb Caudill",
          text: "Hi, Amanda. I thought I would have something visual today.",
        },
        {
          timestamp: "00:01:40.000",
          speaker: "Amanda",
          speakerLabel: "Amanda Pinkston",
          text: "Okay.",
        },
        { timestamp: "00:01:41.000", speaker: "Brent", speakerLabel: "Brent Keller", text: "Bye." },
      ],
    })
  })

  test("uses full names as display names when first names collide", () => {
    const directory = mkdtempSync(join(tmpdir(), "meeting-transcript-"))
    const transcriptPath = join(directory, "same-first-name.md")

    writeFileSync(
      transcriptPath,
      `[00:00:01.000] Alex Smith: First.
[00:00:02.000] Alex Jones: Second.
`,
    )

    const output = execFileSync("node", [scriptPath, transcriptPath], { encoding: "utf8" })
    const parsed = JSON.parse(output)

    expect(parsed.participants).toEqual([
      { name: "Alex Smith", displayName: "Alex Smith" },
      { name: "Alex Jones", displayName: "Alex Jones" },
    ])
    expect(parsed.turns.map((turn: { speaker: string }) => turn.speaker)).toEqual([
      "Alex Smith",
      "Alex Jones",
    ])
  })
})
