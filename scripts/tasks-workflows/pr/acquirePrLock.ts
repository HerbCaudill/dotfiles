import { DatabaseSync } from "node:sqlite"
import { chmod, mkdir } from "node:fs/promises"
import { join } from "node:path"

/** Serialize the scheduled poll and manual runs without stale PID files after a crash. */
export async function acquirePrLock(
  /** Directory of this workflow's checkpoint, never peer ECHO storage. */
  directory: string,
): Promise<() => void> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, "tasks-workflow.lock.sqlite")
  const lock = new DatabaseSync(path)
  try {
    await chmod(path, 0o600)
    lock.exec("PRAGMA busy_timeout = 0; BEGIN EXCLUSIVE")
  } catch {
    lock.close()
    throw new Error("PR workflow already running or its owner lock is unavailable")
  }
  return () => lock.close()
}
