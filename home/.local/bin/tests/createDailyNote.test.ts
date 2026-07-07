import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import { describe, expect, test } from "vitest"

import { getDailyNoteDates } from "../../../../scripts/daily-note/getDailyNoteDates.ts"

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

      expect(readFileSync(join(dailyDir, `${getDailyNoteDates()[0]}.md`), "utf8")).toBe("")
    } finally {
      rmSync(dailyDir, { force: true, recursive: true })
    }
  })
})
