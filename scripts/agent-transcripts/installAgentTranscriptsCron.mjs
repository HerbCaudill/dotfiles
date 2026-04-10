import { CRON_BLOCK_NAME } from "./constants.mjs"
import { getManagedCronLine } from "./getManagedCronLine.mjs"
import { readCrontabContents } from "./readCrontabContents.mjs"
import { upsertManagedBlock } from "./upsertManagedBlock.mjs"
import { writeCrontabContents } from "./writeCrontabContents.mjs"

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
