import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { randomUUID } from "node:crypto"
import type { EnvironmentManifest } from "./types.ts"
import type { SourceOptions } from "./sourceTypes.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import { transportEnvironmentSource } from "./transportEnvironmentSource.ts"
import { assertEnvironmentId } from "./assertEnvironmentId.ts"

/** Own source receipts and transfer an immutable commit; registry checkpoints belong to the lifecycle caller. */
export async function operateEnvironmentSource(
  /** Validated registry identity. */
  manifest: EnvironmentManifest,
  /** Pair new worktrees or synchronize existing owned worktrees. */
  operation: "pair" | "sync",
  /** Native source checkout for initial pairing. */
  source: string,
  /** Injectable Windows transport. */
  options: SourceOptions,
): Promise<string> {
  assertEnvironmentId(manifest.id)
  if (manifest.phase === "removed" || manifest.phase === "running")
    throw new Error("Stop the environment before changing source")
  if (!/^[a-f0-9-]{36}$/.test(manifest.ownerToken))
    throw new Error("Invalid source ownership token")
  await assertNative(source)
  await assertNative(manifest.paths.mac)
  const claim = `${manifest.paths.mac}.drenv-source`
  const receiptPath = join(claim, "owner.json")
  let receipt: Receipt
  if (await exists(claim)) {
    await assertNative(claim)
    receipt = JSON.parse(await readFile(receiptPath, "utf8"))
    if (
      receipt.environmentId !== manifest.id ||
      receipt.ownerToken !== manifest.ownerToken ||
      receipt.path !== manifest.paths.mac
    )
      throw new Error("Refusing foreign source ownership")
    if (!/^[a-f0-9]{40,64}$/.test(receipt.revision))
      throw new Error("Invalid frozen source revision")
    if (receipt.syncedRevision && !/^[a-f0-9]{40}$/.test(receipt.syncedRevision))
      throw new Error("Invalid previously verified source revision")
    if (operation === "pair" && (await realpath(source)) !== receipt.source)
      throw new Error("Source checkout differs from frozen pairing receipt")
  } else {
    if (operation === "sync") throw new Error("Source pairing receipt is missing")
    if (await exists(manifest.paths.mac)) throw new Error("Refusing unowned Mac source destination")
    const canonicalSource = await realpath(source)
    const top = await git(canonicalSource, ["rev-parse", "--show-toplevel"])
    if ((await realpath(top)) !== canonicalSource) throw new Error("Source must be a checkout root")
    const revision = await git(canonicalSource, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${manifest.requestedRevision}^{commit}`,
    ])
    const common = await git(canonicalSource, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ])
    receipt = {
      environmentId: manifest.id,
      ownerToken: manifest.ownerToken,
      path: manifest.paths.mac,
      source: canonicalSource,
      common: await realpath(common),
      revision,
    }
    await mkdir(dirname(claim), { recursive: true })
    await mkdir(claim, { mode: 0o700 })
    await writeFile(receiptPath, JSON.stringify(receipt), { flag: "wx", mode: 0o600 })
  }
  if (!(await exists(manifest.paths.mac))) {
    if (operation === "sync") throw new Error("Owned Mac source worktree is missing")
    await git(receipt.source, [
      "worktree",
      "add",
      "--detach",
      "--",
      manifest.paths.mac,
      receipt.revision,
    ])
  }
  const common = await realpath(
    await git(manifest.paths.mac, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
  )
  const top = await realpath(await git(manifest.paths.mac, ["rev-parse", "--show-toplevel"]))
  if (common !== receipt.common || top !== (await realpath(manifest.paths.mac)))
    throw new Error("Source worktree mapping differs from ownership receipt")
  if (await git(manifest.paths.mac, ["status", "--porcelain", "--untracked-files=all"]))
    throw new Error("Mac source worktree is dirty; commit changes before sync")
  const revision = await git(manifest.paths.mac, ["rev-parse", "HEAD"])
  if (operation === "pair" && revision !== receipt.revision)
    throw new Error("Paired Mac revision changed; use explicit sync")
  const ref = `refs/drenv-transfer/${manifest.ownerToken}/${randomUUID()}`
  const bundle = join(claim, `${randomUUID()}.bundle`)
  await git(manifest.paths.mac, [
    "update-ref",
    ref,
    revision,
    "0000000000000000000000000000000000000000",
  ])
  try {
    const previous = receipt.syncedRevision
    const range = operation === "sync" && previous && previous !== revision ? [`^${previous}`] : []
    await git(manifest.paths.mac, ["bundle", "create", bundle, ref, ...range])
    const verified = await (options.remote ?? transportEnvironmentSource)({
      manifest,
      revision,
      operation,
      bundle,
      ref,
    })
    if (verified !== revision)
      throw new Error("Windows source verification did not match the transferred revision")
    const next = `${receiptPath}.tmp`
    await writeFile(next, JSON.stringify({ ...receipt, syncedRevision: revision }), { mode: 0o600 })
    await rename(next, receiptPath)
    return revision
  } finally {
    await git(manifest.paths.mac, ["update-ref", "-d", ref, revision])
    await rm(bundle, { force: true })
  }
}

/** Reject mounted paths and symlink ancestors before ownership-sensitive filesystem work. */
async function assertNative(
  /** Absolute Mac path. */
  path: string,
) {
  if (!isAbsolute(path) || resolve(path) !== path || /^\/Volumes(?:\/|$)/i.test(path))
    throw new Error("Source requires a native absolute Mac path")
  let current = path
  while (true) {
    if ((await exists(current)) && (await lstat(current)).isSymbolicLink())
      throw new Error("Refusing symlink in source path")
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
}

/** Probe a path without treating permission errors as absence. */
async function exists(
  /** Filesystem path. */
  path: string,
) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

/** Run Git with literal arguments and a bounded bundle creation allowance. */
async function git(
  /** Native checkout root. */
  cwd: string,
  /** Literal Git arguments. */
  args: string[],
) {
  return (await runDrenvCommand({ executable: "git", args, cwd, timeoutMs: 600_000 })).stdout.trim()
}

/** Personal receipt outside all tracked source files. */
type Receipt = {
  /** Stable environment ID. */
  environmentId: string
  /** Registry ownership token. */
  ownerToken: string
  /** Exact Mac destination. */
  path: string
  /** Original canonical checkout root. */
  source: string
  /** Canonical shared Git store. */
  common: string
  /** Frozen initial revision. */
  revision: string
  /** Last independently verified destination revision, used as a bundle prerequisite. */
  syncedRevision?: string
}
