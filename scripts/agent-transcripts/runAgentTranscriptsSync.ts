import { homedir } from "node:os"
import { AGENT_TRANSCRIPTS_REPO_PATH } from "./constants.ts"
import { collectTranscriptEntries } from "./collectTranscriptEntries.ts"
import { commitArchiveChanges } from "./commitArchiveChanges.ts"
import { copyTranscriptEntries } from "./copyTranscriptEntries.ts"
import { ensureArchiveRepo } from "./ensureArchiveRepo.ts"
import { runCommand } from "./runCommand.ts"
import { syncArchiveRemote } from "./syncArchiveRemote.ts"
import { withArchiveLock } from "./withArchiveLock.ts"

/** Save this machine's transcripts, publish them, and retrieve the other machines' snapshots. */
export const runAgentTranscriptsSync = async () => {
  const archiveRepositoryPath = AGENT_TRANSCRIPTS_REPO_PATH
  ensureArchiveRepo(archiveRepositoryPath)
  const machine = runCommand("git", ["config", "--get", "agentTranscripts.machine"], {
    cwd: archiveRepositoryPath,
  }).stdout.trim()
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(machine))
    throw new Error("Set git config agentTranscripts.machine to a stable machine name")

  await withArchiveLock(archiveRepositoryPath, async () => {
    const transcriptEntries = collectTranscriptEntries(homedir(), machine)
    const entryCount = await copyTranscriptEntries(
      archiveRepositoryPath,
      transcriptEntries,
      machine,
    )
    const committed = commitArchiveChanges(archiveRepositoryPath, machine)
    syncArchiveRemote(archiveRepositoryPath)
    console.log(
      JSON.stringify({ archiveRepositoryPath, machine, committed, entryCount, published: true }),
    )
  })
}
