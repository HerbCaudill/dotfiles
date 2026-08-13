import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, test } from "vitest"
import { arePathsEqual } from "../are-paths-equal.ts"
import { chunkSessionFiles } from "../chunk-session-files.ts"

const scriptPath = join(import.meta.dirname, "..", "agent-sessions.ts")

describe("agent-sessions", () => {
  test("lists normalized Claude and Codex sessions", () => {
    const fixture = createFixture()
    const result = spawnSync(process.execPath, [scriptPath, "list"], {
      encoding: "utf8",
      env: fixture.env,
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("claude")
    expect(result.stdout).toContain("claude-session-1234")
    expect(result.stdout).toContain("Fix the flaky login test")
    expect(result.stdout).toContain("codex")
    expect(result.stdout).toContain("codex-session-5678")
    expect(result.stdout).toContain("Build the reports page")
    expect(result.stdout).not.toContain("recommended_plugins")
  })

  test("renders conversation text without tool traffic by default", () => {
    const fixture = createFixture()
    const result = spawnSync(process.execPath, [scriptPath, "show", "claude-session"], {
      encoding: "utf8",
      env: fixture.env,
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("## User")
    expect(result.stdout).toContain("Fix the flaky login test")
    expect(result.stdout).toContain("## Assistant")
    expect(result.stdout).toContain("I found the race condition.")
    expect(result.stdout).not.toContain("pnpm test")
    expect(result.stdout).not.toContain("private tool output")
  })

  test("includes tool calls and results when requested", () => {
    const fixture = createFixture()
    const result = spawnSync(process.execPath, [scriptPath, "show", "claude-session", "--tools"], {
      encoding: "utf8",
      env: fixture.env,
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("## Tool")
    expect(result.stdout).toContain("pnpm test")
    expect(result.stdout).toContain("private tool output")
  })

  test("searches user-visible conversation text across harnesses", () => {
    const fixture = createFixture()
    const result = spawnSync(process.execPath, [scriptPath, "search", "reports"], {
      encoding: "utf8",
      env: fixture.env,
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("codex-session-5678")
    expect(result.stdout).toContain("Build the reports page")
    expect(result.stdout).not.toContain("claude-session-1234")
  })

  test("infers the provider for a transcript outside the default session roots", () => {
    const fixture = createFixture()
    const result = spawnSync(process.execPath, [scriptPath, "show", fixture.exportedClaudePath], {
      encoding: "utf8",
      env: fixture.env,
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("# claude session exported-claude-session")
    expect(result.stdout).toContain("Recover this exported Claude conversation")
  })

  test("filters sessions to the requested working directory", () => {
    const fixture = createFixture()
    const result = spawnSync(
      process.execPath,
      [scriptPath, "list", "--cwd", "/workspace/claude-project"],
      {
        encoding: "utf8",
        env: fixture.env,
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("claude-session-1234")
    expect(result.stdout).not.toContain("codex-session-5678")
  })
})

describe("arePathsEqual", () => {
  test("compares Windows paths without case or separator sensitivity", () => {
    expect(
      arePathsEqual(
        "C:\\Users\\Colleague\\Code\\Project",
        "c:/users/colleague/code/project",
        "win32",
      ),
    ).toBe(true)
  })
})

describe("chunkSessionFiles", () => {
  test("keeps path arguments within the command character budget", () => {
    const files = ["first.jsonl", "second.jsonl", "third.jsonl"].map(path => ({
      provider: "codex" as const,
      path,
    }))

    expect(chunkSessionFiles(files, 200, 15)).toEqual([[files[0]], [files[1]], [files[2]]])
  })
})

/** Create isolated Claude and Codex transcript trees. */
function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "agent-sessions-"))
  const claudeRoot = join(root, "claude", "project")
  const codexRoot = join(root, "codex", "2026", "08", "01")
  const archivedRoot = join(root, "codex-archived")
  const exportedClaudePath = join(root, "exports", "exported-claude-session.jsonl")

  mkdirSync(claudeRoot, { recursive: true })
  mkdirSync(codexRoot, { recursive: true })
  mkdirSync(archivedRoot, { recursive: true })
  mkdirSync(join(root, "exports"), { recursive: true })

  writeFileSync(
    join(claudeRoot, "claude-session-1234.jsonl"),
    [
      JSON.stringify({
        type: "user",
        sessionId: "claude-session-1234",
        cwd: "/workspace/claude-project",
        timestamp: "2026-08-01T10:00:00.000Z",
        message: {
          role: "user",
          content: "Fix the flaky login test",
        },
      }),
      JSON.stringify({
        type: "assistant",
        sessionId: "claude-session-1234",
        cwd: "/workspace/claude-project",
        timestamp: "2026-08-01T10:01:00.000Z",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I found the race condition.",
            },
            {
              type: "tool_use",
              name: "Bash",
              input: { command: "pnpm test" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        sessionId: "claude-session-1234",
        cwd: "/workspace/claude-project",
        timestamp: "2026-08-01T10:01:01.000Z",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              content: "private tool output",
            },
          ],
        },
      }),
    ].join("\n"),
  )

  writeFileSync(
    join(codexRoot, "rollout-2026-08-01T11-00-00-codex-session-5678.jsonl"),
    [
      JSON.stringify({
        timestamp: "2026-08-01T11:00:00.000Z",
        type: "session_meta",
        payload: {
          id: "codex-session-5678",
          cwd: "/workspace/codex-project",
          timestamp: "2026-08-01T11:00:00.000Z",
        },
      }),
      JSON.stringify({
        timestamp: "2026-08-01T11:00:01.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "<recommended_plugins>ignore this</recommended_plugins>",
            },
          ],
        },
      }),
      JSON.stringify({
        timestamp: "2026-08-01T11:00:02.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Build the reports page",
            },
          ],
        },
      }),
      JSON.stringify({
        timestamp: "2026-08-01T11:01:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "The reports page is ready.",
            },
          ],
        },
      }),
    ].join("\n"),
  )

  writeFileSync(
    exportedClaudePath,
    JSON.stringify({
      type: "user",
      sessionId: "exported-claude-session",
      cwd: "C:\\workspace\\exported-project",
      timestamp: "2026-08-01T12:00:00.000Z",
      message: {
        role: "user",
        content: "Recover this exported Claude conversation",
      },
    }),
  )

  return {
    exportedClaudePath,
    env: {
      ...process.env,
      AGENT_SESSIONS_CLAUDE_ROOT: join(root, "claude"),
      AGENT_SESSIONS_CODEX_ROOT: join(root, "codex"),
      AGENT_SESSIONS_CODEX_ARCHIVED_ROOT: archivedRoot,
    },
  }
}
