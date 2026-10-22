import { createHash } from "node:crypto"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { getWindowsCli } from "../getWindowsCli.ts"

test("refuses a changed CLI bundle or a different selected release", async () => {
  const root = await mkdtemp(join(tmpdir(), "tasks-cli-integrity-"))
  const revision = "a".repeat(40)
  const path = join(root, "cli", revision)
  await mkdir(path, { recursive: true })
  const source = "process.stdout.write('ready')"
  const manifest = {
    version: 1,
    revision,
    sha256: createHash("sha256").update(source).digest("hex"),
  }
  await writeFile(join(path, "main.mjs"), source)
  await writeFile(join(path, "manifest.json"), JSON.stringify(manifest))
  expect(await getWindowsCli(root, revision)).toBe(join(path, "main.mjs"))
  await writeFile(join(path, "main.mjs"), source + ";process.exit(1)")
  await expect(getWindowsCli(root, revision)).rejects.toThrow("integrity")
  await writeFile(join(path, "main.mjs"), source)
  await writeFile(
    join(path, "manifest.json"),
    JSON.stringify({ ...manifest, revision: "b".repeat(40) }),
  )
  await expect(getWindowsCli(root, revision)).rejects.toThrow("integrity")
})
