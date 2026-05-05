import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, test, vi } from "vitest"

import { createDailyNoteFiles } from "../createDailyNoteFiles.ts"

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("createDailyNoteFiles", () => {
  test("creates missing daily note files", () => {
    const dailyDir = mkdtempSync(join(tmpdir(), "daily-note-"))

    try {
      createDailyNoteFiles(dailyDir, new Date("2026-04-20T12:00:00"))

      expect(readFileSync(join(dailyDir, "2026-04-21.md"), "utf8")).toBe("")
      expect(readFileSync(join(dailyDir, "2026-03-21.md"), "utf8")).toBe("")
    } finally {
      rmSync(dailyDir, { force: true, recursive: true })
    }
  })

  test("matches created file ownership to the daily notes directory when run as root", async () => {
    const dailyDir = mkdtempSync(join(tmpdir(), "daily-note-"))
    const dailyDirStats = statSync(dailyDir)
    const chownSync = vi.fn()

    vi.doMock("node:fs", async importOriginal => {
      const actual = await importOriginal<typeof import("node:fs")>()

      return {
        ...actual,
        chownSync,
      }
    })

    vi.spyOn(process, "getuid").mockReturnValue(0)

    const { createDailyNoteFiles: createRootOwnedDailyNotes } =
      await import("../createDailyNoteFiles.ts")

    try {
      createRootOwnedDailyNotes(dailyDir, new Date("2026-04-20T12:00:00"))

      expect(chownSync).toHaveBeenCalledWith(
        join(dailyDir, "2026-04-21.md"),
        dailyDirStats.uid,
        dailyDirStats.gid,
      )
    } finally {
      rmSync(dailyDir, { force: true, recursive: true })
    }
  })
})
