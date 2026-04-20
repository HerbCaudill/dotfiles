import { CRON_BLOCK_NAME } from "./constants.ts"
import { getManagedCronLine } from "./getManagedCronLine.ts"
import { readCrontabContents } from "./readCrontabContents.ts"
import { upsertManagedBlock } from "./upsertManagedBlock.ts"
import { writeCrontabContents } from "./writeCrontabContents.ts"

/** Install or update the managed cron entry for transcript syncing. */
export const installAgentTranscriptsCron = () => {
  const updatedCrontabContents = upsertManagedBlock({
    blockBody: getManagedCronLine(),
    existingContents: readCrontabContents(),
    name: CRON_BLOCK_NAME,
  })

  writeCrontabContents(updatedCrontabContents)
  return updatedCrontabContents
}
