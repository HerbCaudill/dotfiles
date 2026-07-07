import { assertSafeMacCheckout } from "./assertSafeMacCheckout.ts"
import { buildWindowsSyncCommand } from "./buildWindowsSyncCommand.ts"
import { commitWipChanges } from "./commitWipChanges.ts"
import { getCurrentBranch } from "./getCurrentBranch.ts"
import { getWipBranch } from "./getWipBranch.ts"
import { pushWipBranch } from "./pushWipBranch.ts"
import { runWindowsCommand } from "./runWindowsCommand.ts"

/** Run drsync. */
export function runDrsync(
  /** The command-line arguments after drsync */
  args: string[],
) {
  assertSafeMacCheckout()

  const branch = getCurrentBranch()
  const wipBranch = getWipBranch(branch)

  commitWipChanges()
  pushWipBranch(wipBranch)
  runWindowsCommand(buildWindowsSyncCommand(wipBranch, args))
}
