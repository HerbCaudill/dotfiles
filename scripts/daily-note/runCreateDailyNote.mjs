import { DEFAULT_DAILY_DIR } from "./constants.mjs"
import { createDailyNoteFiles } from "./createDailyNoteFiles.mjs"

/** Create missing daily note files in the configured directory. */
export const runCreateDailyNote = () => {
  const dailyDir = process.env.DAILY_DIR ?? DEFAULT_DAILY_DIR
  createDailyNoteFiles(dailyDir)
}
