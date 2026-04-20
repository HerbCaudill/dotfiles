import { existsSync } from "node:fs"
import { join, relative } from "node:path"

import { FIXED_TRANSCRIPT_FILES } from "./constants.ts"
import { listFilesRecursively } from "./listFilesRecursively.ts"
import type { TranscriptEntry } from "./types.ts"

/** Build the list of raw transcript artifacts that should be archived. */
export const collectTranscriptEntries = (
  /** The home directory that contains `.claude`, `.codex`, and `.pi`. */
  homeDirectory: string,
): TranscriptEntry[] => {
  const fixedEntries = FIXED_TRANSCRIPT_FILES.flatMap<TranscriptEntry>(entry => {
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
    .filter((filePath: string) => filePath.endsWith(".jsonl"))
    .map((absoluteSourcePath: string) => ({
      absoluteSourcePath,
      archiveRelativePath: join(
        "sources/claude/projects",
        relative(claudeProjectsDirectory, absoluteSourcePath),
      ),
      sourceRelativePath: relative(homeDirectory, absoluteSourcePath),
    }))

  const piSessionsDirectory = join(homeDirectory, ".pi/agent/sessions")
  const piSessionEntries = listFilesRecursively(piSessionsDirectory)
    .filter((filePath: string) => filePath.endsWith(".jsonl"))
    .map((absoluteSourcePath: string) => ({
      absoluteSourcePath,
      archiveRelativePath: join(
        "sources/pi/agent/sessions",
        relative(piSessionsDirectory, absoluteSourcePath),
      ),
      sourceRelativePath: relative(homeDirectory, absoluteSourcePath),
    }))

  return [...fixedEntries, ...claudeProjectEntries, ...piSessionEntries].sort((left, right) =>
    left.archiveRelativePath.localeCompare(right.archiveRelativePath),
  )
}
