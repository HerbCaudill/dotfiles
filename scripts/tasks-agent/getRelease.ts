import { createHash } from "node:crypto"
import { readFile, readlink } from "node:fs/promises"
import { join } from "node:path"
import { privateDirectory } from "./privateDirectory.ts"

/** Resolve only a prepared SHA release and verify that its frozen lockfile still matches. */
export async function getRelease(
  /** Private installation root. */
  root: string,
  /** Explicit candidate, or the currently selected release. */
  revision?: string,
) {
  await privateDirectory(root)
  await privateDirectory(join(root, "releases"))
  const target = revision ? `releases/${revision}` : await readlink(join(root, "current"))
  if (!/^releases\/[a-f0-9]{40}$/.test(target))
    throw new Error("The current release link must select a prepared commit.")
  const selected = target.slice("releases/".length)
  if (!/^[a-f0-9]{40}$/.test(selected))
    throw new Error("The selected release is not a full commit SHA.")
  const path = join(root, "releases", selected)
  await privateDirectory(path)
  const release = JSON.parse(await readFile(join(path, "release.json"), "utf8"))
  if (
    typeof release.node !== "string" ||
    release.node.split(".")[0] !== process.version.split(".")[0]
  )
    throw new Error(
      "The release was prepared with a different Node major; prepare compatible dependencies before selection.",
    )
  const lockHash = createHash("sha256")
    .update(await readFile(join(path, "pnpm-lock.yaml")))
    .digest("hex")
  if (release.version !== 1 || release.revision !== selected || release.lockHash !== lockHash)
    throw new Error("The prepared release is missing or its dependency lockfile changed.")
  return { path, revision: selected }
}
