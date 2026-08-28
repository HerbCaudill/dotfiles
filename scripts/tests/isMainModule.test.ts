import { mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, test } from "vitest"

import { isMainModule } from "../isMainModule.ts"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("isMainModule", () => {
  test("recognizes an entry point invoked through a symlink", () => {
    const target = fileURLToPath(import.meta.url)
    const directory = mkdtempSync(join(tmpdir(), "is-main-module-"))
    temporaryDirectories.push(directory)
    const link = join(directory, "linked-entry-point.ts")
    symlinkSync(target, link)

    expect(isMainModule(import.meta.url, link)).toBe(true)
  })
})
