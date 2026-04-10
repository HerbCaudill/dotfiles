import { homedir } from "node:os"

import { AGENT_TRANSCRIPTS_REPO_PATH } from "./constants.mjs"
import { collectTranscriptEntries } from "./collectTranscriptEntries.mjs"
import { commitArchiveChanges } from "./commitArchiveChanges.mjs"
import { copyTranscriptEntries } from "./copyTranscriptEntries.mjs"
import { ensureArchiveRepo } from "./ensureArchiveRepo.mjs"

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
