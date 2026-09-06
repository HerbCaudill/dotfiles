import { randomUUID } from "node:crypto"
import { lstat, open, rename, symlink, unlink } from "node:fs/promises"
import { join } from "node:path"
import { getRelease } from "./getRelease.ts"
import { waitForServiceLock } from "./waitForServiceLock.ts"

/** Select a prepared release only after the old service relinquishes its database ownership. */
export async function selectRelease(
  /** Explicit candidate and supervisor boundary. */
  options: {
    /** Private installation root. */
    root: string
    /** Full SHA of a prepared release. */
    revision: string
    /** Stop automatic restarts before waiting for the current owner. */
    stop: () => Promise<void>
    /** Optional shorter deadline for isolated verification. */
    timeoutMs?: number
    /** Optional ownership boundary for isolated verification. */
    acquire?: () => Promise<{ close: () => void }>
  },
) {
  const release = await getRelease(options.root, options.revision)
  const current = join(options.root, "current")
  const existing = await lstat(current).catch(error => {
    if (error.code !== "ENOENT") throw error
  })
  if (existing && !existing.isSymbolicLink())
    throw new Error("The current release path is not a managed symlink.")
  await options.stop()
  const lock = await waitForServiceLock({
    release: release.path,
    stateDir: join(options.root, "agent"),
    timeoutMs: options.timeoutMs,
    acquire: options.acquire,
  })
  const temporary = join(options.root, `.select-${randomUUID()}`)
  try {
    await symlink(`releases/${release.revision}`, temporary)
    await rename(temporary, current)
    const directory = await open(options.root, "r")
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
  } finally {
    try {
      await unlink(temporary).catch(error => {
        if (error.code !== "ENOENT") throw error
      })
    } finally {
      lock.close()
    }
  }
  return release
}
