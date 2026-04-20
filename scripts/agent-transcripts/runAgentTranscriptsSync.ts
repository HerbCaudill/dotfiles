import { homedir } from "node:os"

import { AGENT_TRANSCRIPTS_REPO_PATH } from "./constants.ts"
import { collectTranscriptEntries } from "./collectTranscriptEntries.ts"
import { commitArchiveChanges } from "./commitArchiveChanges.ts"
import { copyTranscriptEntries } from "./copyTranscriptEntries.ts"
import { ensureArchiveRepo } from "./ensureArchiveRepo.ts"

/** Sync raw local transcript artifacts into the managed archive repository. */
export const runAgentTranscriptsSync = () => {
  ensureArchiveRepo(AGENT_TRANSCRIPTS_REPO_PATH)

  const transcriptEntries = collectTranscriptEntries(homedir())
  copyTranscriptEntries(AGENT_TRANSCRIPTS_REPO_PATH, transcriptEntries)

  const committed = commitArchiveChanges(AGENT_TRANSCRIPTS_REPO_PATH)

  console.log(
    JSON.stringify({
      archiveRepositoryPath: AGENT_TRANSCRIPTS_REPO_PATH,
      committed,
      entryCount: transcriptEntries.length,
    }),
  )
}
