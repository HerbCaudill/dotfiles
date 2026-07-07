import { WINDOWS_REPO_PATH } from "./constants.ts"
import { quotePowerShell } from "./quotePowerShell.ts"

/** Build the PowerShell command that verifies the Windows checkout is clean. */
export function buildWindowsCleanCheckCommand() {
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    `Set-Location -LiteralPath ${quotePowerShell(WINDOWS_REPO_PATH)}`,
    "$status = git status --porcelain",
    "if ($status) { [Console]::Out.WriteLine('drsync: Windows checkout has uncommitted changes; commit, stash, or clean it before drsync.'); [Console]::Out.WriteLine($status); exit 2 }",
  ].join("; ")
}
