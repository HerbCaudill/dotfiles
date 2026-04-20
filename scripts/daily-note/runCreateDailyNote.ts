import { DEFAULT_DAILY_DIR } from "./constants.ts"
import { createDailyNoteFiles } from "./createDailyNoteFiles.ts"

/** Create missing daily note files in the configured directory. */
export const runCreateDailyNote = () => {
  const dailyDir = process.env.DAILY_DIR ?? DEFAULT_DAILY_DIR
  createDailyNoteFiles(dailyDir)
}
