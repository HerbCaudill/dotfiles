import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test } from "vitest"
import { getLaunchSettings } from "../getLaunchSettings.ts"

let root: string
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "localhost-dev-"))
  execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "ignore" })
  await writeFile(join(root, "fixture"), "fixture\n")
  execFileSync("git", ["add", "fixture"], { cwd: root })
  execFileSync(
    "git",
    ["-c", "user.name=Codex", "-c", "user.email=codex@localhost", "commit", "-m", "Fixture"],
    { cwd: root, stdio: "ignore" },
  )
  execFileSync("git", ["remote", "add", "origin", "git@github.com:HerbCaudill/tasks.git"], {
    cwd: root,
  })
})
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

test("uses the repository for a clean HTTPS URL and preserves the command arguments", () => {
  expect(getLaunchSettings(root, ["pnpm", "dev:app"])).toEqual({
    name: "tasks",
    url: "https://tasks.localhost",
    command: ["pnpm", "dev:app"],
  })
})

test("prefixes detached worktrees with their folder and keeps the service inside that prefix", () => {
  const checkout = join(root, "tofu")
  execFileSync("git", ["worktree", "add", "--detach", checkout], { cwd: root, stdio: "ignore" })
  expect(getLaunchSettings(checkout, ["--service", "api", "node", "server.ts"])).toEqual({
    name: "tofu.api.tasks",
    url: "https://tofu.api.tasks.localhost",
    command: ["node", "server.ts"],
  })
})

test("rejects invalid service labels and missing commands", () => {
  expect(() => getLaunchSettings(root, ["--service", "bad/service", "vite"])).toThrow("service")
  expect(() => getLaunchSettings(root, [])).toThrow("command")
})
