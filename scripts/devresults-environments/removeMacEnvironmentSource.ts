import { lstat, readFile, realpath, rm } from "node:fs/promises"
import { dirname } from "node:path"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Verify source ownership and cleanliness without changing local files. */
export async function preflightMacEnvironmentSource(
  /** Validated environment mapping. */
  manifest: EnvironmentManifest,
) {
  const path = manifest.paths.mac
  const claim = `${path}.drenv-source`
  let receipt
  try {
    receipt = JSON.parse(await readFile(`${claim}/owner.json`, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      for (const target of [path, claim]) {
        try {
          await lstat(target)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
          throw error
        }
        throw new Error("Refusing source removal without ownership")
      }
      return
    }
    throw error
  }
  if (
    receipt.environmentId !== manifest.id ||
    receipt.ownerToken !== manifest.ownerToken ||
    receipt.path !== path
  )
    throw new Error("Refusing foreign Mac source removal")
  for (let cursor = claim; cursor !== dirname(cursor); cursor = dirname(cursor)) {
    if ((await lstat(cursor)).isSymbolicLink())
      throw new Error("Refusing source removal through symlinks")
  }
  const exists = await lstat(path).then(
    () => true,
    error => {
      if (error.code === "ENOENT") return false
      throw error
    },
  )
  if (exists) {
    if ((await lstat(path)).isSymbolicLink()) throw new Error("Refusing source symlink removal")
    const common = (
      await runDrenvCommand({
        executable: "git",
        args: ["-C", path, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      })
    ).stdout.trim()
    if ((await realpath(common)) !== receipt.common)
      throw new Error("Source Git store no longer matches ownership")
    const dirty = await runDrenvCommand({
      executable: "git",
      args: ["-C", path, "status", "--porcelain", "--untracked-files=all"],
    })
    if (dirty.stdout.trim())
      throw new Error("Mac source has uncommitted work; preserve it before removal")
  }
  return { path, claim, exists }
}

/** Recheck source ownership and cleanliness immediately before local deletion. */
export async function removeMacEnvironmentSource(manifest: EnvironmentManifest) {
  const source = await preflightMacEnvironmentSource(manifest)
  if (!source) return
  if (source.exists)
    await runDrenvCommand({
      executable: "git",
      args: ["-C", source.path, "worktree", "remove", "--force", "--", source.path],
    })
  await rm(source.claim, { recursive: true })
}
