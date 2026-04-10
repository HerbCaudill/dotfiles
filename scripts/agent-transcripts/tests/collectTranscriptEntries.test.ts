import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

import { collectTranscriptEntries } from "../collectTranscriptEntries.mjs"

const tempDirs: string[] = []

describe("collectTranscriptEntries", () => {
  test("collects Claude JSONL files and Codex raw stores into stable archive paths", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "agent-transcripts-home-"))
    tempDirs.push(homeDir)

    mkdirSync(join(homeDir, ".claude/projects/project-a"), { recursive: true })
    mkdirSync(join(homeDir, ".codex"), { recursive: true })

    writeFileSync(join(homeDir, ".claude/history.jsonl"), "claude-history")
    writeFileSync(join(homeDir, ".claude/projects/project-a/session-1.jsonl"), "claude-session")
    writeFileSync(join(homeDir, ".codex/history.jsonl"), "codex-history")
    writeFileSync(join(homeDir, ".codex/state_5.sqlite"), "state")
    writeFileSync(join(homeDir, ".codex/state_5.sqlite-wal"), "state-wal")
    writeFileSync(join(homeDir, ".codex/logs_1.sqlite"), "logs")

    const entries = collectTranscriptEntries(homeDir)

    expect(
      entries.map(entry => ({
        archiveRelativePath: entry.archiveRelativePath,
        sourceRelativePath: entry.sourceRelativePath,
      })),
    ).toEqual([
      {
        archiveRelativePath: "sources/claude/history.jsonl",
        sourceRelativePath: ".claude/history.jsonl",
      },
      {
        archiveRelativePath: "sources/claude/projects/project-a/session-1.jsonl",
        sourceRelativePath: ".claude/projects/project-a/session-1.jsonl",
      },
      {
        archiveRelativePath: "sources/codex/history.jsonl",
        sourceRelativePath: ".codex/history.jsonl",
      },
      {
        archiveRelativePath: "sources/codex/logs/logs_1.sqlite",
        sourceRelativePath: ".codex/logs_1.sqlite",
      },
      {
        archiveRelativePath: "sources/codex/state/state_5.sqlite",
        sourceRelativePath: ".codex/state_5.sqlite",
      },
      {
        archiveRelativePath: "sources/codex/state/state_5.sqlite-wal",
        sourceRelativePath: ".codex/state_5.sqlite-wal",
      },
    ])
  })

  test("skips missing optional files", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "agent-transcripts-home-"))
    tempDirs.push(homeDir)

    mkdirSync(join(homeDir, ".claude/projects/project-a"), { recursive: true })

    writeFileSync(join(homeDir, ".claude/projects/project-a/session-1.jsonl"), "claude-session")

    const entries = collectTranscriptEntries(homeDir)

    expect(entries.map(entry => entry.archiveRelativePath)).toEqual([
      "sources/claude/projects/project-a/session-1.jsonl",
    ])
  })
})

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true })
  }
})
