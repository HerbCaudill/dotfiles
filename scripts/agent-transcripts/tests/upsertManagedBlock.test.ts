import { describe, expect, test } from "vitest"

import { upsertManagedBlock } from "../upsertManagedBlock.ts"

describe("upsertManagedBlock", () => {
  test("appends a managed block when none exists", () => {
    const result = upsertManagedBlock({
      blockBody:
        "*/15 * * * * /bin/zsh -lc '~/.local/bin/agent-transcripts-sync >> /tmp/agent-transcripts-sync.log 2>&1'",
      existingContents: 'MAILTO=""\n0 0 * * * /usr/bin/true\n',
      name: "agent-transcripts",
    })

    expect(result).toBe(
      [
        'MAILTO=""',
        "0 0 * * * /usr/bin/true",
        "",
        "# BEGIN agent-transcripts",
        "*/15 * * * * /bin/zsh -lc '~/.local/bin/agent-transcripts-sync >> /tmp/agent-transcripts-sync.log 2>&1'",
        "# END agent-transcripts",
        "",
      ].join("\n"),
    )
  })

  test("replaces an existing managed block without touching other entries", () => {
    const result = upsertManagedBlock({
      blockBody:
        "*/15 * * * * /bin/zsh -lc '~/.local/bin/agent-transcripts-sync >> /tmp/agent-transcripts-sync.log 2>&1'",
      existingContents: [
        'MAILTO=""',
        "# BEGIN agent-transcripts",
        "0 * * * * /usr/bin/false",
        "# END agent-transcripts",
        "5 * * * * /usr/bin/true",
        "",
      ].join("\n"),
      name: "agent-transcripts",
    })

    expect(result).toBe(
      [
        'MAILTO=""',
        "# BEGIN agent-transcripts",
        "*/15 * * * * /bin/zsh -lc '~/.local/bin/agent-transcripts-sync >> /tmp/agent-transcripts-sync.log 2>&1'",
        "# END agent-transcripts",
        "5 * * * * /usr/bin/true",
        "",
      ].join("\n"),
    )
  })
})
