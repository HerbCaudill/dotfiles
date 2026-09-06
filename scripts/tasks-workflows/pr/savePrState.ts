import { mkdir, open, rename, rm } from "node:fs/promises"
import { dirname } from "node:path"
import { randomUUID } from "node:crypto"
import { parsePrState } from "./parsePrState.ts"
import type { PrState } from "./types.ts"

/** Fsync a validated private replacement and its directory before acknowledging progress. */
export async function savePrState(
  /** Original checkpoints plus the next confirmed phase. */
  state: PrState,
  /** Existing PR checkpoint destination. */
  path: string,
  /** Atomic replacement boundary, injectable for interruption tests. */
  replace: (from: string, to: string) => Promise<void> = rename,
): Promise<void> {
  const data = JSON.stringify(parsePrState(state), null, 2) + "\n"
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const file = await open(temporary, "wx", 0o600)
    try {
      await file.writeFile(data, "utf8")
      await file.sync()
    } finally {
      await file.close()
    }
    await replace(temporary, path)
    const directory = await open(dirname(path), "r")
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
  } finally {
    await rm(temporary, { force: true })
  }
}
