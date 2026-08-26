import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  appendEmailDecision,
  loadEmailDecisionLog,
  loadEmailProcessingState,
  saveEmailProcessingState,
} from "../emailProcessingStorage.ts"
import type { DecisionLogEntry } from "../supervisorTypes.ts"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true })))
})

describe("email processing storage", () => {
  it("returns empty state when no state file exists", async () => {
    const directory = await createTemporaryDirectory()

    await expect(loadEmailProcessingState(join(directory, "state.json"))).resolves.toEqual({
      lastHistoryId: null,
      lastCompletedAt: null,
      retryMessageIds: [],
      archiveReversalSenders: [],
    })
  })

  it("saves normalized state atomically with owner-only permissions", async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, "nested", "state.json")
    const state = {
      lastHistoryId: "105",
      lastCompletedAt: "2026-08-26T12:00:00.000Z",
      retryMessageIds: ["message-1", "message-1", "message-2"],
      archiveReversalSenders: ["PERSON@example.com", "person@example.com"],
    }

    await saveEmailProcessingState(state, path)

    await expect(loadEmailProcessingState(path)).resolves.toEqual({
      lastHistoryId: "105",
      lastCompletedAt: "2026-08-26T12:00:00.000Z",
      retryMessageIds: ["message-1", "message-2"],
      archiveReversalSenders: ["person@example.com"],
    })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
  })

  it("appends sanitized decisions and ignores a truncated final JSONL record", async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, "decisions.jsonl")
    const decision = createDecision()

    await appendEmailDecision(
      {
        ...decision,
        subject: "Login code 123456",
        reason: "Secret token sk-secret1234567890",
        policySignals: ["account-987654321"],
      },
      path,
    )
    await writeFile(path, `${await readFile(path, "utf8")}{"timestamp":`, {
      mode: 0o600,
    })

    const decisions = await loadEmailDecisionLog(path)

    expect(decisions).toEqual([
      {
        ...decision,
        subject: "Login code [REDACTED]",
        reason: "Secret token [REDACTED]",
        policySignals: ["account-[REDACTED]"],
      },
    ])
    expect((await stat(path)).mode & 0o777).toBe(0o600)
  })

  it("preserves an exact sender address while redacting display-name and medical details", async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, "decisions.jsonl")

    await appendEmailDecision(
      {
        ...createDecision(),
        sender: "Patient 123456 <person1234@example.com>",
        subject: "Medical test result: positive",
        reason: "The prescription changed after the diagnosis.",
      },
      path,
    )

    await expect(loadEmailDecisionLog(path)).resolves.toEqual([
      {
        ...createDecision(),
        sender: "Patient [REDACTED] <person1234@example.com>",
        subject: "[REDACTED MEDICAL DETAIL]",
        reason: "[REDACTED MEDICAL DETAIL]",
      },
    ])
  })

  it("never persists body-like fields supplied at runtime", async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, "decisions.jsonl")
    const decisionWithBody = {
      ...createDecision(),
      body: "private message body",
      snippet: "private snippet",
      accessToken: "private access token",
    } as DecisionLogEntry

    await appendEmailDecision(decisionWithBody, path)

    const contents = await readFile(path, "utf8")
    expect(contents).not.toContain("private message body")
    expect(contents).not.toContain("private snippet")
    expect(contents).not.toContain("private access token")
    await expect(loadEmailDecisionLog(path)).resolves.toEqual([createDecision()])
  })
})

/** Create and track one isolated test directory. */
async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "email-processing-test-"))
  temporaryDirectories.push(directory)
  return directory
}

/** Create one complete sanitized decision fixture. */
function createDecision(): DecisionLogEntry {
  return {
    timestamp: "2026-08-26T12:00:00.000Z",
    messageId: "message-1",
    threadId: "thread-1",
    sender: "Vendor <vendor@example.com>",
    subject: "A proposal",
    originalLabels: ["INBOX"],
    decision: "none",
    classification: "no-action",
    confidence: "low",
    reason: "No action required.",
    policySignals: ["routine"],
    gmailUrl: "https://mail.google.com/mail/#all/thread-1",
  }
}
