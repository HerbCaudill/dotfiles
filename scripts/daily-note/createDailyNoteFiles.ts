import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { getDailyNoteDates } from "./getDailyNoteDates.ts"

/** Create any missing daily note files for the configured date range. */
export const createDailyNoteFiles = (
  /** The directory where daily note files live. */
  dailyDir: string,
  /** The reference date used to calculate note dates. */
  referenceDate = new Date(),
): void => {
  for (const date of getDailyNoteDates(referenceDate)) {
    const filePath = join(dailyDir, `${date}.md`)

    if (!existsSync(filePath)) {
      writeFileSync(filePath, "", { flag: "wx" })
    }
  }
}
