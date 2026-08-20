import { spawnSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, test } from "vitest"
import { assertPrivateCredentialFile } from "../assertPrivateCredentialFile"
import { repairPrivateCredentialFile } from "../repairPrivateCredentialFile"

const cleanups: Array<() => void> = []

afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach(cleanup => cleanup())
})

describe("assertPrivateCredentialFile", () => {
  test("accepts an owner-only regular credential file", () => {
    const fixture = createCredentialFixture()
    chmodSync(fixture.path, 0o600)

    expect(() => assertPrivateCredentialFile(fixture.path)).not.toThrow()
  })

  test("refuses credentials readable by the owner group or other users", () => {
    const fixture = createCredentialFixture()

    for (const mode of [0o640, 0o604, 0o644]) {
      chmodSync(fixture.path, mode)
      expect(() => assertPrivateCredentialFile(fixture.path)).toThrow(safeError)
    }
  })

  test("refuses a symbolic link without following it", () => {
    const fixture = createCredentialFixture()
    chmodSync(fixture.path, 0o600)
    const link = join(fixture.directory, "linked-secrets")
    symlinkSync(fixture.path, link)

    expect(() => assertPrivateCredentialFile(link)).toThrow(safeError)
  })

  test("refuses a directory and a file not owned by the expected user", () => {
    const fixture = createCredentialFixture()
    const directory = join(fixture.directory, "credential-directory")
    mkdirSync(directory, { mode: 0o600 })

    expect(() => assertPrivateCredentialFile(directory)).toThrow(safeError)
    expect(() => assertPrivateCredentialFile(fixture.path, (process.getuid?.() ?? 0) + 1)).toThrow(
      safeError,
    )
  })

  test("the command boundary reports no credential path or metadata", () => {
    const fixture = createCredentialFixture()
    chmodSync(fixture.path, 0o644)
    const result = runValidator("--check", fixture.path)

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe(`${safeError}\n`)
    expect(result.stderr).not.toContain(fixture.path)
  })

  test("activation repair tightens only a safe regular file", () => {
    const fixture = createCredentialFixture()
    chmodSync(fixture.path, 0o644)

    const result = runValidator("--repair-mode", fixture.path)

    expect(result.status).toBe(0)
    expect(statSync(fixture.path).mode & 0o777).toBe(0o600)
  })

  test("activation repair refuses a symbolic link without changing its target", () => {
    const fixture = createCredentialFixture()
    chmodSync(fixture.path, 0o644)
    const link = join(fixture.directory, "linked-secrets")
    symlinkSync(fixture.path, link)

    const result = runValidator("--repair-mode", link)

    expect(result.status).toBe(1)
    expect(result.stderr).toBe(`${safeError}\n`)
    expect(statSync(fixture.path).mode & 0o777).toBe(0o644)
  })

  test("activation repair cannot chmod a symlink target swapped in before open", () => {
    const fixture = createCredentialFixture()
    chmodSync(fixture.path, 0o644)
    const original = join(fixture.directory, "original-secrets")
    const target = join(fixture.directory, "target")
    writeFileSync(target, "target contents\n", { mode: 0o644 })
    const targetContents = readFileSync(target, "utf8")

    expect(() =>
      repairPrivateCredentialFile(fixture.path, process.getuid?.() ?? 0, {
        beforeOpen: () => {
          renameSync(fixture.path, original)
          symlinkSync(target, fixture.path)
        },
      }),
    ).toThrow(safeError)
    expect(statSync(target).mode & 0o777).toBe(0o644)
    expect(readFileSync(target, "utf8")).toBe(targetContents)
    expect(statSync(original).mode & 0o777).toBe(0o644)
  })

  test("activation repair refuses a different regular inode swapped in before open", () => {
    const fixture = createCredentialFixture()
    chmodSync(fixture.path, 0o644)
    const original = join(fixture.directory, "original-secrets")
    const replacement = join(fixture.directory, "replacement-secrets")
    writeFileSync(replacement, "replacement contents\n", { mode: 0o644 })

    expect(() =>
      repairPrivateCredentialFile(fixture.path, process.getuid?.() ?? 0, {
        beforeOpen: () => {
          renameSync(fixture.path, original)
          renameSync(replacement, fixture.path)
        },
      }),
    ).toThrow(safeError)
    expect(statSync(fixture.path).mode & 0o777).toBe(0o644)
    expect(statSync(original).mode & 0o777).toBe(0o644)
  })
})

function createCredentialFixture() {
  const directory = mkdtempSync(join(tmpdir(), "marvin-credential-"))
  cleanups.push(() => rmSync(directory, { force: true, recursive: true }))
  const path = join(directory, "secrets")
  writeFileSync(path, "OPENAI_API_KEY=fixture\n", { mode: 0o600 })
  return { directory, path }
}

function runValidator(operation: "--check" | "--repair-mode", path: string) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      fileURLToPath(new URL("../assertPrivateCredentialFile.ts", import.meta.url)),
      operation,
      path,
      String(process.getuid?.()),
    ],
    { encoding: "utf8" },
  )
}

const safeError = "Marvin digest credentials are unavailable"
