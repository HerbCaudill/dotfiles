import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Serialize syncs in this clone and recover only our own locks left by exited processes. */
export const withArchiveLock = async <T>(
  /** Working archive repository. */
  archiveRepositoryPath: string,
  /** Work that must have exclusive access to this clone. */
  work: () => Promise<T>,
): Promise<T> => {
  const lock = join(archiveRepositoryPath, ".git", "agent-transcripts-sync.lock")
  let descriptor: number
  try {
    descriptor = openSync(lock, "wx")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    const pid = Number(readFileSync(lock, "utf8"))
    if (!Number.isInteger(pid) || pid < 1) throw new Error(`Invalid sync lock: ${lock}`)
    try {
      process.kill(pid, 0)
      throw new Error(`Archive sync is already running (PID ${pid})`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
    }
    unlinkSync(lock)
    descriptor = openSync(lock, "wx")
  }
  writeFileSync(descriptor, String(process.pid))
  closeSync(descriptor)
  try {
    return await work()
  } finally {
    unlinkSync(lock)
  }
}
