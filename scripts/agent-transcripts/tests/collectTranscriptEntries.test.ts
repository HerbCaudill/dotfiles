import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

import { collectTranscriptEntries } from "../collectTranscriptEntries.ts"

const tempDirs: string[] = []

describe("collectTranscriptEntries", () => {
  test("collects Claude, Codex, and Pi transcript artifacts into stable archive paths", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "agent-transcripts-home-"))
    tempDirs.push(homeDir)

    mkdirSync(join(homeDir, ".claude/projects/project-a"), { recursive: true })
    mkdirSync(join(homeDir, ".codex"), { recursive: true })
    mkdirSync(join(homeDir, ".pi/agent/sessions/project-a"), { recursive: true })

    writeFileSync(join(homeDir, ".claude/history.jsonl"), "claude-history")
    writeFileSync(join(homeDir, ".claude/projects/project-a/session-1.jsonl"), "claude-session")
    writeFileSync(join(homeDir, ".codex/history.jsonl"), "codex-history")
    mkdirSync(join(homeDir, ".codex/sessions/2026/10"), { recursive: true })
    mkdirSync(join(homeDir, ".codex/archived_sessions"), { recursive: true })
    writeFileSync(join(homeDir, ".codex/sessions/2026/10/active.jsonl"), "active")
    writeFileSync(join(homeDir, ".codex/archived_sessions/archived.jsonl"), "archived")
    writeFileSync(join(homeDir, ".pi/agent/sessions/project-a/session-1.jsonl"), "pi-session")

    const entries = collectTranscriptEntries(homeDir, "mini")

    expect(
      entries.map(entry => ({
        archiveRelativePath: entry.archiveRelativePath,
        sourceRelativePath: entry.sourceRelativePath,
      })),
    ).toEqual([
      {
        archiveRelativePath: "machines/mini/claude/history.jsonl",
        sourceRelativePath: ".claude/history.jsonl",
      },
      {
        archiveRelativePath: "machines/mini/claude/projects/project-a/session-1.jsonl",
        sourceRelativePath: ".claude/projects/project-a/session-1.jsonl",
      },
      {
        archiveRelativePath: "machines/mini/codex/archived_sessions/archived.jsonl",
        sourceRelativePath: ".codex/archived_sessions/archived.jsonl",
      },
      {
        archiveRelativePath: "machines/mini/codex/history.jsonl",
        sourceRelativePath: ".codex/history.jsonl",
      },
      {
        archiveRelativePath: "machines/mini/codex/sessions/2026/10/active.jsonl",
        sourceRelativePath: ".codex/sessions/2026/10/active.jsonl",
      },
      {
        archiveRelativePath: "machines/mini/pi/agent/sessions/project-a/session-1.jsonl",
        sourceRelativePath: ".pi/agent/sessions/project-a/session-1.jsonl",
      },
    ])
  })

  test("skips missing optional files", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "agent-transcripts-home-"))
    tempDirs.push(homeDir)

    mkdirSync(join(homeDir, ".claude/projects/project-a"), { recursive: true })
    mkdirSync(join(homeDir, ".pi/agent/sessions/project-a"), { recursive: true })

    writeFileSync(join(homeDir, ".claude/projects/project-a/session-1.jsonl"), "claude-session")
    writeFileSync(join(homeDir, ".pi/agent/sessions/project-a/session-1.jsonl"), "pi-session")

    const entries = collectTranscriptEntries(homeDir, "macbook")

    expect(entries.map(entry => entry.archiveRelativePath)).toEqual([
      "machines/macbook/claude/projects/project-a/session-1.jsonl",
      "machines/macbook/pi/agent/sessions/project-a/session-1.jsonl",
    ])
  })
})

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true })
  }
})
