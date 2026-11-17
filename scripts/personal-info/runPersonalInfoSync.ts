import { syncPersonalInfo } from "./syncPersonalInfo.ts"
import { syncPersonalFilesToMini } from "./syncPersonalFilesToMini.ts"

/** A supported synchronization direction. */
type SyncDirection = "pull" | "push"

/** A function that performs personal-info synchronization. */
type Sync = (direction: SyncDirection) => void

/** Run personal-info synchronization from command-line arguments. */
export const runPersonalInfoSync = (
  /** Command-line arguments after the executable name. */
  args: string[],
  /** The synchronization implementation. */
  sync: Sync = syncPersonalInfo,
  /** Mirror local files to the mini without accessing 1Password. */
  mirror: () => unknown = syncPersonalFilesToMini,
) => {
  const [direction, ...extraArguments] = args

  if (
    (direction !== "pull" && direction !== "push" && direction !== "mini") ||
    extraArguments.length > 0
  ) {
    throw new Error("Usage: personal-info-sync <pull|push|mini>")
  }

  if (direction === "mini") {
    mirror()
    return
  }
  sync(direction)
  if (direction === "pull") mirror()
}
