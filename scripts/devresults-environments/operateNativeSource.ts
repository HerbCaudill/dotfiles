import { lstat, mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Prepare an editable native Windows worktree with a private Git store and verified ownership. */
export async function operateNativeSource(
  /** Reserved native environment. */
  manifest: EnvironmentManifest,
  /** Explicit source checkout for initial creation; omitted for sync. */
  source?: string,
) {
  if (manifest.sourceMode !== "native-windows" || process.platform !== "win32")
    throw new Error("Native source operations require Windows")
  const path = manifest.paths.windows
  const claim = `${path}.drenv-source`
  const marker = join(claim, "owner.json")
  const repository = join(claim, "repository.git")
  await assertNative(path)
  await assertNative(claim)
  await assertNative(repository)
  const canonical = (value: string) => resolve(value).toLowerCase()
  let receipt
  try {
    receipt = JSON.parse(await readFile(marker, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    if (!source) throw new Error("Native source receipt is missing")
    if ((await exists(path)) || (await exists(claim)))
      throw new Error("Refusing unowned native source")
    source = await realpath(source)
    const top = await git(source, ["rev-parse", "--show-toplevel"])
    if (canonical(top) !== canonical(source)) throw new Error("Source must be a checkout root")
    const revision = await git(source, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${manifest.requestedRevision}^{commit}`,
    ])
    receipt = {
      environmentId: manifest.id,
      ownerToken: manifest.ownerToken,
      path,
      source,
      revision,
      syncedRevision: revision,
    }
    await mkdir(dirname(claim), { recursive: true })
    await mkdir(claim)
    await writeFile(marker, JSON.stringify(receipt), { flag: "wx" })
  }
  if (
    receipt.environmentId !== manifest.id ||
    receipt.ownerToken !== manifest.ownerToken ||
    receipt.path !== path ||
    !/^[a-f0-9]{40}$/.test(receipt.revision)
  )
    throw new Error("Foreign native source receipt")
  if (source && canonical(await realpath(source)) !== canonical(receipt.source))
    throw new Error("Native source selection changed")
  if (!(await exists(repository)))
    await git(receipt.source, [
      "clone",
      "-c",
      "core.autocrlf=false",
      "--bare",
      "--no-hardlinks",
      "--",
      receipt.source,
      repository,
    ])
  if (!(await exists(path))) {
    if (!source) throw new Error("Native worktree is missing")
    await git(repository, ["worktree", "add", "--detach", "--", path, receipt.revision])
  }
  const common = await git(path, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
  if (
    canonical(common) !== canonical(repository) ||
    canonical(await git(path, ["rev-parse", "--show-toplevel"])) !== canonical(path)
  )
    throw new Error("Native source Git mapping changed")
  if (await git(path, ["status", "--porcelain", "--untracked-files=all"]))
    throw new Error("Commit native worktree changes before deployment")
  const revision = await git(path, ["rev-parse", "HEAD"])
  if (source && revision !== receipt.revision)
    throw new Error("Native creation revision changed; use sync")
  const temporary = `${marker}.tmp`
  await writeFile(temporary, JSON.stringify({ ...receipt, syncedRevision: revision }))
  await rename(temporary, marker)
  return revision
}

/** Probe without hiding permission errors. */
async function exists(path: string) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

/** Invoke Git without a shell and retain static errors at the process boundary. */
async function git(cwd: string, args: string[]) {
  return (await runDrenvCommand({ executable: "git", args, cwd, timeoutMs: 600_000 })).stdout.trim()
}

/** Refuse path redirection without traversing dependency junctions inside an owned worktree. */
async function assertNative(path: string) {
  for (let cursor = path; cursor !== dirname(cursor); cursor = dirname(cursor)) {
    try {
      if ((await lstat(cursor)).isSymbolicLink())
        throw new Error("Native source path traverses a reparse point")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }
}
