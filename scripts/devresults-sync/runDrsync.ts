import { assertSafeMacCheckout } from "./assertSafeMacCheckout.ts"
import { buildWindowsCleanCheckCommand } from "./buildWindowsCleanCheckCommand.ts"
import { buildWindowsSyncCommand } from "./buildWindowsSyncCommand.ts"
import { commitWipChanges } from "./commitWipChanges.ts"
import { getCurrentBranch } from "./getCurrentBranch.ts"
import { getWipBranch } from "./getWipBranch.ts"
import { pushWipBranch } from "./pushWipBranch.ts"
import { runWindowsCommandOrExit } from "./runWindowsCommand.ts"

/** Run drsync. */
export async function runDrsync(
  /** The command-line arguments after drsync */
  args: string[],
) {
  assertSafeMacCheckout()

  const branch = getCurrentBranch()
  const wipBranch = getWipBranch(branch)

  await runWindowsCommandOrExit(buildWindowsCleanCheckCommand())
  commitWipChanges()
  pushWipBranch(wipBranch)
  await runWindowsCommandOrExit(buildWindowsSyncCommand(wipBranch, args))
}
