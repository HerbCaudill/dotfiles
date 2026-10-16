import { expect, test } from "vitest"
import { toReadableTranscriptRecord } from "../toReadableTranscriptRecord.ts"

test("preserves Codex session identity and readable tool output", () => {
  expect(
    toReadableTranscriptRecord(
      {
        type: "session_meta",
        timestamp: "2026-10-16T10:00:00Z",
        payload: {
          id: "session",
          cwd: "C:\\Code\\project",
          timestamp: "2026-10-16T10:00:00Z",
          developer_instructions: "Runtime context",
        },
      },
      "codex",
    ),
  ).toEqual({
    type: "session_meta",
    timestamp: "2026-10-16T10:00:00Z",
    payload: { id: "session", cwd: "C:\\Code\\project", timestamp: "2026-10-16T10:00:00Z" },
  })
  const tool = {
    type: "response_item",
    timestamp: "2026-10-16T10:01:00Z",
    payload: { type: "function_call_output", output: "All tests passed" },
  }
  expect(toReadableTranscriptRecord(tool, "codex")).toEqual(tool)
})

test("keeps Claude user and assistant turns with their recorded dates", () => {
  const record = {
    type: "user",
    sessionId: "session",
    cwd: "/Code/project",
    timestamp: "2026-10-16T10:00:00Z",
    message: { role: "user", content: "Continue the fix" },
    gitBranch: "main",
  }
  expect(toReadableTranscriptRecord(record, "claude")).toEqual({
    type: "user",
    sessionId: "session",
    cwd: "/Code/project",
    timestamp: "2026-10-16T10:00:00Z",
    isSidechain: undefined,
    message: { role: "user", content: "Continue the fix" },
  })
})
