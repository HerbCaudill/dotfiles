import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, test } from "vitest"
import { withArchiveLock } from "../withArchiveLock.ts"

const tempDirs: string[] = []

test("rejects a concurrent writer and releases the lock after a failed sync", async () => {
  const root = createArchive()
  await expect(
    withArchiveLock(root, async () => {
      await expect(withArchiveLock(root, async () => undefined)).rejects.toThrow("already running")
      throw new Error("Network unavailable")
    }),
  ).rejects.toThrow("Network unavailable")
  expect(existsSync(join(root, ".git/agent-transcripts-sync.lock"))).toBe(false)
  expect(await withArchiveLock(root, async () => "retry succeeded")).toBe("retry succeeded")
})

test("recovers its own lock after its writer process has exited", async () => {
  const root = createArchive()
  writeFileSync(join(root, ".git/agent-transcripts-sync.lock"), "2147483647")
  expect(await withArchiveLock(root, async () => "recovered")).toBe("recovered")
})

/** Create an isolated lock directory. */
function createArchive() {
  const root = mkdtempSync(join(tmpdir(), "archive-lock-"))
  tempDirs.push(root)
  mkdirSync(join(root, ".git"))
  return root
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
