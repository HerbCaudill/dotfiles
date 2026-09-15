import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout } from "node:timers/promises"

/** Serialize registry transactions across processes; never steal an uncertain lock. */
export async function withRegistryLock<T>(
  /** Private registry directory. */
  directory: string,
  /** Complete transaction, including reads and atomic writes. */
  operation: () => Promise<T>,
  /** Maximum contention wait; stale locks require explicit operator inspection. */
  timeoutMs = 10_000,
): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const lock = join(directory, "registry.lock")
  const deadline = Date.now() + timeoutMs
  while (true) {
    try {
      await mkdir(lock, { mode: 0o700 })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      if (Date.now() >= deadline)
        throw new Error(
          `Registry lock busy: ${lock}. Inspect its owner before recovering an interrupted operation; locks are never stolen automatically.`,
        )
      await setTimeout(20)
    }
  }
  try {
    await writeFile(
      join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
      { mode: 0o600 },
    )
    return await operation()
  } finally {
    await rm(lock, { recursive: true })
  }
}
