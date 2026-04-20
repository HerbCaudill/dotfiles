import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import type { TranscriptEntry } from "./types.ts"

/** Copy the selected transcript artifacts into the archive repository. */
export const copyTranscriptEntries = (
  /** The root of the archive repository. */
  archiveRepositoryPath: string,
  /** The source entries that should be copied. */
  transcriptEntries: TranscriptEntry[],
): void => {
  for (const entry of transcriptEntries) {
    const targetPath = join(archiveRepositoryPath, entry.archiveRelativePath)

    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(entry.absoluteSourcePath, targetPath)
  }
}
