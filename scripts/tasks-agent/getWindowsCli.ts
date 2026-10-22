import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { privateDirectory } from "./privateDirectory.ts"

/** Select a verified, dependency-free CLI compiled from the selected immutable release. */
export async function getWindowsCli(
  /** Managed installation root. */
  root: string,
  /** Already verified selected commit. */
  revision: string,
): Promise<string> {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Invalid CLI release revision")
  const parent = join(root, "cli")
  const path = join(parent, revision)
  await privateDirectory(parent)
  await privateDirectory(path)
  const manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8"))
  const entry = join(path, "main.mjs")
  const sha256 = createHash("sha256")
    .update(await readFile(entry))
    .digest("hex")
  if (manifest.version !== 1 || manifest.revision !== revision || manifest.sha256 !== sha256)
    throw new Error("Tasks CLI artifact integrity check failed")
  return entry
}
