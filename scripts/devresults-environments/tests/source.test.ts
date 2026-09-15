import { mkdtemp, realpath, readFile, writeFile, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it } from "vitest"
import { createRegistry } from "../createRegistry.ts"
import { runDrenvCommand } from "../runDrenvCommand.ts"
import { pairEnvironmentSource } from "../pairEnvironmentSource.ts"
import { syncEnvironmentSource } from "../syncEnvironmentSource.ts"

const directories: string[] = []
afterEach(async () => {
  for (const path of directories) await rm(path, { recursive: true, force: true })
})

/** Create a disposable native repository and personal registry. */
async function setup() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drenv-source-")))
  directories.push(root)
  const source = join(root, "primary")
  await mkdir(source)
  const git = async (...args: string[]) =>
    (await runDrenvCommand({ executable: "git", args, cwd: source })).stdout.trim()
  await git("init")
  await git("config", "user.email", "test@localhost")
  await git("config", "user.name", "Test")
  await writeFile(join(source, "file.txt"), "first")
  await git("add", ".")
  await git("commit", "-m", "first")
  const registry = createRegistry({
    directory: join(root, "registry"),
    macRoot: join(root, "worktrees"),
    windowsRoot: "C:\\DrenvTest",
    windowsHost: "devresults-vm",
  })
  const manifest = await registry.reserve({
    id: "source-test",
    inventory: { windowsPorts: [], macPorts: [] },
  })
  return { root, source, git, manifest }
}

it("pairs a frozen committed revision without touching dirty source and resumes that revision", async () => {
  const { source, git, manifest } = await setup()
  const first = await git("rev-parse", "HEAD")
  await writeFile(join(source, "file.txt"), "uncommitted")
  const seen: string[] = []
  const remote = async (request: { revision: string }) => {
    seen.push(request.revision)
    return request.revision
  }
  expect(await pairEnvironmentSource(manifest, source, { remote })).toBe(first)
  expect(await readFile(join(source, "file.txt"), "utf8")).toBe("uncommitted")
  await git("commit", "-am", "second")
  expect(await pairEnvironmentSource(manifest, source, { remote })).toBe(first)
  expect(seen).toEqual([first, first])
  expect(await readFile(join(manifest.paths.mac, "file.txt"), "utf8")).toBe("first")
})

it("refuses foreign destination paths before remote effects", async () => {
  const { source, manifest } = await setup()
  await mkdir(manifest.paths.mac, { recursive: true })
  await expect(
    pairEnvironmentSource(manifest, source, {
      remote: async () => {
        throw new Error("should not call")
      },
    }),
  ).rejects.toThrow("unowned")
})

it("retries pairing after remote interruption and syncs only clean committed HEAD", async () => {
  const { source, manifest } = await setup()
  await expect(
    pairEnvironmentSource(manifest, source, {
      remote: async () => {
        throw new Error("interrupted")
      },
    }),
  ).rejects.toThrow("interrupted")
  const remote = async (request: { revision: string }) => request.revision
  const first = await pairEnvironmentSource(manifest, source, { remote })
  await writeFile(join(manifest.paths.mac, "file.txt"), "second")
  await expect(syncEnvironmentSource(manifest, { remote })).rejects.toThrow("dirty")
  await runDrenvCommand({
    executable: "git",
    args: ["-C", manifest.paths.mac, "commit", "-am", "second"],
  })
  const revision = await syncEnvironmentSource(manifest, { remote })
  expect(revision).not.toBe(first)
})

it("rejects a foreign source receipt and a mismatched remote verification", async () => {
  const { source, manifest } = await setup()
  await expect(
    pairEnvironmentSource(manifest, source, { remote: async () => "0".repeat(40) }),
  ).rejects.toThrow("verification")
  const marker = `${manifest.paths.mac}.drenv-source/owner.json`
  const receipt = JSON.parse(await readFile(marker, "utf8"))
  await writeFile(marker, JSON.stringify({ ...receipt, ownerToken: "foreign" }))
  await expect(
    syncEnvironmentSource(manifest, { remote: async () => "unexpected" }),
  ).rejects.toThrow("foreign")
})
