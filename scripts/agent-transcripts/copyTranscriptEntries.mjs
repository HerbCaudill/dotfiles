import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

/** Copy the selected transcript artifacts into the archive repository. */
export const copyTranscriptEntries = (
  /** The root of the archive repository. */
  archiveRepositoryPath,
  /** The source entries that should be copied. */
  transcriptEntries,
) => {
  for (const entry of transcriptEntries) {
    const targetPath = join(archiveRepositoryPath, entry.archiveRelativePath)

    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(entry.absoluteSourcePath, targetPath)
  }
}
