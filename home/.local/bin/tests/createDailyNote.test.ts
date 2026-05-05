import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import { describe, expect, test } from "vitest"

describe("create-daily-note launcher", () => {
  test("creates daily note files when invoked as a script", () => {
    const dailyDir = mkdtempSync(join(tmpdir(), "daily-note-launcher-"))

    try {
      execFileSync(join(process.cwd(), "home/.local/bin/create-daily-note"), [], {
        env: {
          ...process.env,
          DAILY_DIR: dailyDir,
        },
      })

      expect(readFileSync(join(dailyDir, "2026-05-06.md"), "utf8")).toBe("")
    } finally {
      rmSync(dailyDir, { force: true, recursive: true })
    }
  })
})
