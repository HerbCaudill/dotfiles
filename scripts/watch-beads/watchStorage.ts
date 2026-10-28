import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/** Private registry root; override only for an isolated test or separate service. */
export const watchHome = process.env.WATCH_BEADS_HOME ?? join(homedir(), ".local/share/watch-beads")

/** Locate the single enrollment and state file for a canonical repository path. */
export function watchPaths(
  /** Real repository path, shared by start, stop and the daemon. */
  repo: string,
) {
  const key = createHash("sha256").update(repo).digest("hex")
  return {
    config: join(watchHome, "repositories", `${key}.json`),
    state: join(watchHome, "state", `${key}.json`),
  }
}

/** Read optional state while surfacing malformed files instead of resetting them. */
export async function readWatchJson<T>(
  /** Configuration or state file to read. */
  path: string,
): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

/** Atomically replace private state so a crash cannot leave partial JSON. */
export async function writeWatchJson(
  /** Destination owned by this watcher. */
  path: string,
  /** Serializable enrollment or snapshot. */
  value: unknown,
) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 })
  await rename(temporary, path)
}
