import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve, sep } from "node:path"
import { expect, test } from "vitest"
import { createEvidenceInventory } from "../createEvidenceInventory.ts"

test("inventories hidden files and empty folders without following source links", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "mini-evidence-test-"))
  try {
    const source = join(fixture, "source")
    await mkdir(join(source, "empty"), { recursive: true })
    await writeFile(join(source, ".proof"), "hello")
    const outside = join(fixture, "outside")
    await writeFile(outside, "must not be followed")
    await symlink(outside, join(source, "link"), "file")
    const output = join(fixture, "inventory.ndjson")
    const summary = await createEvidenceInventory(source, output)
    const records = (await readFile(output, "utf8"))
      .trim()
      .split("\n")
      .map(line => JSON.parse(line))
    expect(records.find(record => record.path === ".proof")).toMatchObject({
      kind: "file",
      size: 5,
      sha256: createHash("sha256").update("hello").digest("hex"),
    })
    expect(records.find(record => record.path === "link")).toMatchObject({
      kind: "symlink",
      target: outside,
    })
    expect(records.find(record => record.path === "empty")).toMatchObject({ kind: "directory" })
    expect(summary).toMatchObject({ files: 1, bytes: 5, symlinks: 1, directories: 1, special: 0 })
    await expect(createEvidenceInventory(source, output)).rejects.toThrow()
    await expect(
      createEvidenceInventory(source, join(source, "bad:inventory.ndjson")),
    ).rejects.toThrow("outside")
  } finally {
    if (!resolve(fixture).startsWith(resolve(tmpdir()) + sep + "mini-evidence-test-"))
      throw new Error("Refusing cleanup outside the fixture directory")
    await rm(fixture, { recursive: true, force: true })
  }
})
