import { installAgentTranscriptsCron } from "./installAgentTranscriptsCron.ts"

/** Install the managed transcript sync cron entry and print the result. */
export const runInstallAgentTranscriptsCron = () => {
  const updatedCrontabContents = installAgentTranscriptsCron()
  console.log(updatedCrontabContents)
}
