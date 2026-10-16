import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, test } from "vitest"
import { commitArchiveChanges } from "../commitArchiveChanges.ts"
import { runCommand } from "../runCommand.ts"
import { syncArchiveRemote } from "../syncArchiveRemote.ts"

const tempDirs: string[] = []

test("publishes independent machine snapshots and brings the other machine's work back", () => {
  const root = mkdtempSync(join(tmpdir(), "transcript-sync-"))
  tempDirs.push(root)
  const remote = join(root, "remote.git")
  runCommand("git", ["init", "--bare", "-b", "main", remote])
  const mac = createClone(root, remote, "macbook")
  const mini = createClone(root, remote, "mini")

  writeSnapshot(mac, "macbook", "first Mac session")
  commitArchiveChanges(mac, "macbook")
  syncArchiveRemote(mac)
  writeSnapshot(mini, "mini", "first mini session")
  commitArchiveChanges(mini, "mini")
  syncArchiveRemote(mini)
  syncArchiveRemote(mac)

  expect(readFileSync(join(mac, "machines/mini/session.jsonl"), "utf8")).toBe("first mini session")
  expect(readFileSync(join(mini, "machines/macbook/session.jsonl"), "utf8")).toBe(
    "first Mac session",
  )
  expect(runCommand("git", ["status", "--porcelain"], { cwd: mac }).stdout).toBe("")
})

/** Create a configured working clone of a shared archive. */
function createClone(root: string, remote: string, machine: string) {
  const path = join(root, machine)
  runCommand("git", ["clone", remote, path])
  runCommand("git", ["config", "user.name", "Archive test"], { cwd: path })
  runCommand("git", ["config", "user.email", "archive-test@localhost"], { cwd: path })
  return path
}

/** Create one machine's sample transcript. */
function writeSnapshot(path: string, machine: string, text: string) {
  mkdirSync(join(path, "machines", machine), { recursive: true })
  writeFileSync(join(path, "machines", machine, "session.jsonl"), text)
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
