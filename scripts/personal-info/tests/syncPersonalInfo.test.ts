import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"

import { syncPersonalInfo } from "../syncPersonalInfo.ts"

/** Temporary directories created by the current test. */
const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach(directory => rmSync(directory, { force: true, recursive: true }))
})

describe("syncPersonalInfo", () => {
  test("pull writes the secure note to a private local file", () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, "personal-info.md")
    const runOp = vi.fn((_args: string[], _input?: string) => secureNoteJson("personal details"))

    syncPersonalInfo("pull", { filePath, runOp })

    expect(readFileSync(filePath, "utf8")).toBe("personal details")
    expect(statSync(filePath).mode & 0o777).toBe(0o600)
    expect(runOp).toHaveBeenCalledOnce()
    expect(runOp.mock.calls[0]?.[1]).toBeUndefined()
  })

  test("push sends the local file through stdin without putting it in command arguments", () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, "personal-info.md")
    const localContents = "updated personal details"
    const calls: Array<{ args: string[]; input?: string }> = []

    writeFileSync(filePath, localContents, { mode: 0o600 })

    syncPersonalInfo("push", {
      filePath,
      runOp: (args, input) => {
        calls.push({ args, input })
        return args[1] === "get" ? secureNoteJson("old personal details") : ""
      },
    })

    expect(calls).toHaveLength(2)
    expect(calls.flatMap(call => call.args)).not.toContain(localContents)
    expect(JSON.parse(calls[1]?.input ?? "").fields).toContainEqual(
      expect.objectContaining({ id: "notesPlain", value: localContents }),
    )
  })

  test("push rejects an item without a Secure Note body", () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, "personal-info.md")
    const runOp = vi.fn(() => JSON.stringify({ id: "item-id", fields: [] }))

    writeFileSync(filePath, "personal details", { mode: 0o600 })

    expect(() => syncPersonalInfo("push", { filePath, runOp })).toThrow(
      "The 1Password item is not a Secure Note with a notes field",
    )
    expect(runOp).toHaveBeenCalledOnce()
  })
})

/** Create and track a temporary directory for cleanup. */
const createTemporaryDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), "personal-info-sync-"))
  temporaryDirectories.push(directory)
  return directory
}

/** Build a minimal 1Password Secure Note response. */
const secureNoteJson = (/** The note body. */ value: string) =>
  JSON.stringify({
    id: "item-id",
    category: "SECURE_NOTE",
    fields: [
      {
        id: "notesPlain",
        type: "STRING",
        purpose: "NOTES",
        label: "notesPlain",
        value,
      },
    ],
  })
