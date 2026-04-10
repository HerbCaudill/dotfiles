import { existsSync } from "node:fs"
import { join, relative } from "node:path"

import { FIXED_TRANSCRIPT_FILES } from "./constants.mjs"
import { listFilesRecursively } from "./listFilesRecursively.mjs"

/** Build the list of raw transcript artifacts that should be archived. */
export const collectTranscriptEntries = (
  /** The home directory that contains `.claude` and `.codex`. */
  homeDirectory,
) => {
  const fixedEntries = FIXED_TRANSCRIPT_FILES.flatMap(entry => {
    const absoluteSourcePath = join(homeDirectory, entry.sourceRelativePath)

    if (!existsSync(absoluteSourcePath)) {
      return []
    }

    return [
      {
        absoluteSourcePath,
        archiveRelativePath: entry.archiveRelativePath,
        sourceRelativePath: entry.sourceRelativePath,
      },
    ]
  })

  const claudeProjectsDirectory = join(homeDirectory, ".claude/projects")
  const claudeProjectEntries = listFilesRecursively(claudeProjectsDirectory)
    .filter(filePath => filePath.endsWith(".jsonl"))
    .map(absoluteSourcePath => ({
      absoluteSourcePath,
      archiveRelativePath: join(
        "sources/claude/projects",
        relative(claudeProjectsDirectory, absoluteSourcePath),
      ),
      sourceRelativePath: relative(homeDirectory, absoluteSourcePath),
    }))

  return [...fixedEntries, ...claudeProjectEntries].sort((left, right) =>
    left.archiveRelativePath.localeCompare(right.archiveRelativePath),
  )
}
