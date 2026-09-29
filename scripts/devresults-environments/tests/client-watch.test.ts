import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { afterEach, expect, it } from "vitest"
import { captureClientEdits } from "../captureClientEdits.ts"
import { publishClientBuild } from "../publishClientBuild.ts"
import { parseDrenvArgs } from "../parseDrenvArgs.ts"

const directories: string[] = []
async function temporary() {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-watch-test-")))
  directories.push(directory)
  return directory
}
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true })
})

it("requires an explicit environment for watch", () => {
  expect(parseDrenvArgs(["watch", "design-refresh"])).toEqual({
    command: "watch",
    id: "design-refresh",
  })
  expect(() => parseDrenvArgs(["watch"])).toThrow("requires an environment ID")
})

it("captures saved frontend edits and deletions, but refuses backend changes", async () => {
  const root = await temporary()
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  git("init", "-q")
  git("config", "user.name", "Test")
  git("config", "user.email", "test@localhost")
  await mkdir(join(root, "DevResults/Web/Css"), { recursive: true })
  await writeFile(join(root, "DevResults/Web/Css/app.scss"), "old")
  await writeFile(join(root, "server.cs"), "old")
  git("add", ".")
  git("commit", "-qm", "baseline")
  const baseline = git("rev-parse", "HEAD")
  await writeFile(join(root, "DevResults/Web/Css/app.scss"), "new")
  expect((await captureClientEdits(root, baseline)).files).toEqual({
    "DevResults/Web/Css/app.scss": Buffer.from("new").toString("base64"),
  })
  await rm(join(root, "DevResults/Web/Css/app.scss"))
  expect((await captureClientEdits(root, baseline)).files["DevResults/Web/Css/app.scss"]).toBeNull()
  await writeFile(join(root, "server.cs"), "changed")
  await expect(captureClientEdits(root, baseline)).rejects.toThrow("drenv sync")
})

it("publishes assets before the manifest and retains files used by open pages", async () => {
  const root = await temporary()
  const source = join(root, "build")
  const target = join(root, "served")
  await mkdir(join(source, ".vite"), { recursive: true })
  await mkdir(target)
  await writeFile(join(source, "app-new.js"), "new")
  await writeFile(
    join(source, ".vite/manifest.json"),
    JSON.stringify({ app: { file: "app-new.js" } }),
  )
  await writeFile(join(target, "app-old.js"), "old")
  await publishClientBuild(source, target)
  expect(await readFile(join(target, "app-old.js"), "utf8")).toBe("old")
  expect(await readFile(join(target, "app-new.js"), "utf8")).toBe("new")
  const published = await readFile(join(target, ".vite/manifest.json"), "utf8")
  await writeFile(
    join(source, ".vite/manifest.json"),
    JSON.stringify({ app: { file: "missing.js" } }),
  )
  await expect(publishClientBuild(source, target)).rejects.toThrow()
  expect(await readFile(join(target, ".vite/manifest.json"), "utf8")).toBe(published)
})

it("tolerates a missing frame during Windows replacement, but rejects malformed input", async () => {
  const { readWatchFrame } = await import("../readWatchFrame.ts")
  const path = join(await temporary(), "frame.json")
  expect(await readWatchFrame(path)).toBeUndefined()
  await writeFile(path, JSON.stringify({ heartbeat: 123, digest: "saved", files: {} }))
  expect(await readWatchFrame(path)).toMatchObject({ digest: "saved" })
  await writeFile(path, "invalid")
  await expect(readWatchFrame(path)).rejects.toThrow()
})
