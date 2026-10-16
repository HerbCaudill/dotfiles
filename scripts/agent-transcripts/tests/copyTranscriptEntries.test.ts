import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gunzipSync } from "node:zlib"
import { afterEach, expect, test } from "vitest"
import { collectTranscriptEntries } from "../collectTranscriptEntries.ts"
import { copyTranscriptEntries } from "../copyTranscriptEntries.ts"

const tempDirs: string[] = []

test("round-trips split gzip transcripts and retains sessions removed from the source", async () => {
  const root = mkdtempSync(join(tmpdir(), "archive-copy-"))
  tempDirs.push(root)
  const home = join(root, "home")
  const archive = join(root, "archive")
  mkdirSync(join(home, ".claude/projects/project"), { recursive: true })
  const source = join(home, ".claude/projects/project/session.jsonl")
  const text = `${JSON.stringify({ type: "user", sessionId: "session", message: { role: "user", content: "Keep this conversation" } })}\n`
  writeFileSync(source, text)
  await copyTranscriptEntries(archive, collectTranscriptEntries(home, "mini"), "mini", 20)
  rmSync(source)
  await copyTranscriptEntries(archive, [], "mini", 20)
  const machineRoot = join(archive, "machines/mini")
  const manifest = JSON.parse(readFileSync(join(machineRoot, "manifest.json"), "utf8"))
  const entry = manifest.files["claude/projects/project/session.jsonl"]
  expect(entry.paths.length).toBeGreaterThan(1)
  expect(entry.summary.id).toBe("session")
  expect(
    gunzipSync(
      Buffer.concat(entry.paths.map((path: string) => readFileSync(join(machineRoot, path)))),
    ).toString(),
  ).toBe(text)
})

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
