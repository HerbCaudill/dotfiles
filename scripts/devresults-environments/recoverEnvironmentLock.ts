import { lstat, readFile, rm } from "node:fs/promises"
import { join } from "node:path"

/** Explicitly release a local abandoned lock only when its recorded PID is absent and its receipt is unchanged. */
export async function recoverEnvironmentLock(
  /** Exact private directory whose transaction or operation lock is being recovered. */
  directory: string,
) {
  const lock = join(directory, "registry.lock")
  let stat
  try {
    stat = await lstat(lock)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  if (stat.isSymbolicLink() || !stat.isDirectory())
    throw new Error("Refusing recovery of a foreign lock path")
  const file = join(lock, "owner.json")
  const before = await readFile(file, "utf8")
  const owner = JSON.parse(before)
  if (
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 0 ||
    !Number.isFinite(Date.parse(owner.createdAt))
  )
    throw new Error("Malformed lock owner requires inspection")
  try {
    process.kill(owner.pid, 0)
    throw new Error("Recorded lock process is still alive; recovery refused")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
  }
  if ((await readFile(file, "utf8")) !== before || (await lstat(lock)).ino !== stat.ino)
    throw new Error("Lock changed during recovery")
  await rm(lock, { recursive: true })
}
