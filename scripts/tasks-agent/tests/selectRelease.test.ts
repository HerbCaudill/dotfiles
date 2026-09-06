import { expect, test } from "vitest"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { selectRelease } from "../selectRelease.ts"

/** Prepare two isolated releases without installing or starting a real service. */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tasks-selection-"))
  for (const revision of ["a".repeat(40), "b".repeat(40)]) {
    const directory = join(root, "releases", revision)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(join(directory, "pnpm-lock.yaml"), "frozen")
    await writeFile(
      join(directory, "release.json"),
      JSON.stringify({
        version: 1,
        node: process.version,
        revision,
        lockHash: createHash("sha256").update("frozen").digest("hex"),
      }),
    )
  }
  await symlink(`releases/${"a".repeat(40)}`, join(root, "current"))
  return root
}

test("selection waits for the stopped owner to release storage and changes only the release link", async () => {
  const root = await fixture()
  let owned = true
  let locked = false
  let stopped = false
  try {
    await selectRelease({
      root,
      revision: "b".repeat(40),
      stop: async () => {
        stopped = true
        setImmediate(() => {
          owned = false
        })
      },
      acquire: async () => {
        expect(stopped).toBe(true)
        if (owned) throw new Error("still draining")
        locked = true
        return {
          close() {
            locked = false
          },
        }
      },
    })
    expect(await readlink(join(root, "current"))).toBe(`releases/${"b".repeat(40)}`)
    expect(locked).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a service that retains ownership leaves the old release selected", async () => {
  const root = await fixture()
  try {
    await expect(
      selectRelease({
        root,
        revision: "b".repeat(40),
        timeoutMs: 5,
        stop: async () => {},
        acquire: async () => {
          throw new Error("owned")
        },
      }),
    ).rejects.toThrow("unchanged")
    expect(await readlink(join(root, "current"))).toBe(`releases/${"a".repeat(40)}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a release prepared for another Node major cannot replace the selected release", async () => {
  const root = await fixture()
  try {
    const revision = "b".repeat(40)
    const path = join(root, "releases", revision, "release.json")
    const release = JSON.parse(await readFile(path, "utf8"))
    await writeFile(path, JSON.stringify({ ...release, node: "v99.0.0" }))
    await expect(
      selectRelease({
        root,
        revision,
        stop: async () => {},
        acquire: async () => ({ close() {} }),
      }),
    ).rejects.toThrow("Node")
    expect(await readlink(join(root, "current"))).toBe(`releases/${"a".repeat(40)}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
