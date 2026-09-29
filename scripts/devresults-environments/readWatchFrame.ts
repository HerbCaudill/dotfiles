import { readFile } from "node:fs/promises"

/** Windows replacement can briefly hide the frame; the heartbeat lease bounds retries. */
export async function readWatchFrame(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as {
      stop?: boolean
      heartbeat: number
      digest: string
      files: Record<string, string | null>
    }
  } catch (error) {
    if (["ENOENT", "EBUSY"].includes((error as NodeJS.ErrnoException).code ?? "")) return undefined
    throw error
  }
}
