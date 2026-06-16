import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

/** Find all `.mjs` files beneath a directory. */
const listMjsFiles = (
  /** The directory to scan. */
  directoryPath: string,
): string[] =>
  readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
    const entryPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      return listMjsFiles(entryPath)
    }

    return entry.name.endsWith(".mjs") ? [entryPath] : []
  })

describe("TypeScript script migration", () => {
  test("does not leave any .mjs source files behind", () => {
    expect(listMjsFiles(join(process.cwd(), "scripts"))).toEqual([])
    expect(existsSync(join(process.cwd(), "vitest.config.mjs"))).toBe(false)
    expect(existsSync(join(process.cwd(), "vitest.config.ts"))).toBe(true)
  })

  test("uses .ts entrypoints for managed node binaries", () => {
    expect(
      readFileSync(join(process.cwd(), "home/.local/bin/agent-transcripts-sync"), "utf8"),
    ).toContain("runAgentTranscriptsSync.ts")
    expect(
      readFileSync(join(process.cwd(), "home/.local/bin/create-daily-note"), "utf8"),
    ).toContain("runCreateDailyNote.ts")
  })

  test("uses an explicit node runtime for the daily note launcher", () => {
    expect(
      readFileSync(join(process.cwd(), "home/.local/bin/create-daily-note"), "utf8"),
    ).toContain("/etc/profiles/per-user/herbcaudill/bin/node --experimental-strip-types")
  })
})
