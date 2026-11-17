import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, test, vi } from "vitest"

import { syncPersonalFilesToMini } from "../syncPersonalFilesToMini.ts"

/** Temporary source directories used by these tests. */
const directories: string[] = []

afterEach(() =>
  directories.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })),
)

test("delivers both private files exactly through stdin and verifies the receiver's hashes", () => {
  const directory = createSources()
  const runSSH = vi.fn((_args: string[], input: string) => acknowledge(input))

  expect(syncPersonalFilesToMini({ directory, runSSH })).toEqual([
    "personal-info.md",
    "low-stakes-passwords.json",
  ])

  const [args, input] = runSSH.mock.calls[0]!
  const { files } = JSON.parse(input)
  expect(args).toContain("BatchMode=yes")
  expect(args).toContain("mini")
  for (const file of files) {
    const source = readFileSync(join(directory, file.name))
    expect(Buffer.from(file.contents, "base64")).toEqual(source)
    expect(file.sha256).toBe(createHash("sha256").update(source).digest("hex"))
    expect(args.join(" ")).not.toContain(source.toString())
    expect(statSync(join(directory, file.name)).mode & 0o777).toBe(0o600)
  }
})

test("does not report success when a receiver returns a different hash", () => {
  const directory = createSources()
  const runSSH = (_args: string[], input: string) => {
    const receipt = JSON.parse(acknowledge(input))
    receipt.files[0].sha256 = "incorrect hash"
    return JSON.stringify(receipt)
  }
  expect(() => syncPersonalFilesToMini({ directory, runSSH })).toThrow(
    "Mini did not verify both private files",
  )
})

test("rejects invalid password JSON without exposing its contents or sending either file", () => {
  const directory = createSources()
  writeFileSync(join(directory, "low-stakes-passwords.json"), 'secret: "broken JSON"')
  const runSSH = vi.fn()
  expect(() => syncPersonalFilesToMini({ directory, runSSH })).toThrow(
    "The local password file must contain a JSON object",
  )
  expect(runSSH).not.toHaveBeenCalled()
})

test("a failed delivery can be retried without changing the source files", () => {
  const directory = createSources()
  const runSSH = vi.fn((_args: string[], input: string) => acknowledge(input))
  runSSH.mockImplementationOnce(() => {
    throw new Error("Mini is unavailable")
  })
  expect(() => syncPersonalFilesToMini({ directory, runSSH })).toThrow("Mini is unavailable")
  expect(syncPersonalFilesToMini({ directory, runSSH })).toHaveLength(2)
  expect(runSSH.mock.calls[0]?.[1]).toBe(runSSH.mock.calls[1]?.[1])
})

/** Create representative private files without using real personal information. */
const createSources = () => {
  const directory = mkdtempSync(join(tmpdir(), "personal-files-"))
  directories.push(directory)
  writeFileSync(join(directory, "personal-info.md"), "# Personal info\nBarcelona – café\n")
  writeFileSync(
    join(directory, "low-stakes-passwords.json"),
    JSON.stringify({
      "example.test": { url: "https://example.test", password: 'quotes" $() ` & \\ café' },
    }),
  )
  return directory
}

/** Return the content hashes a successful receiver must acknowledge. */
const acknowledge = (input: string) =>
  JSON.stringify({
    files: JSON.parse(input).files.map((file: { name: string; sha256: string }) => ({
      name: file.name,
      sha256: file.sha256,
      changed: true,
    })),
  })
