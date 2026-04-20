import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { getDailyNoteDates } from "./getDailyNoteDates.mjs"

/** Create any missing daily note files for the configured date range. */
export const createDailyNoteFiles = (
  /** The directory where daily note files live. */
  dailyDir,
  /** The reference date used to calculate note dates. */
  referenceDate = new Date(),
) => {
  for (const date of getDailyNoteDates(referenceDate)) {
    const filePath = join(dailyDir, `${date}.md`)

    if (!existsSync(filePath)) {
      writeFileSync(filePath, "", { flag: "wx" })
    }
  }
}
