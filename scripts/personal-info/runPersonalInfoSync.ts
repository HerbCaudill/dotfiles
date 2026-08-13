import { syncPersonalInfo } from "./syncPersonalInfo.ts"

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
) => {
  const [direction, ...extraArguments] = args

  if ((direction !== "pull" && direction !== "push") || extraArguments.length > 0) {
    throw new Error("Usage: personal-info-sync <pull|push>")
  }

  sync(direction)
}
