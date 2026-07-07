import { WINDOWS_REPO_PATH } from "./constants.ts"
import { buildWindowsDirtyGuardCommand } from "./buildWindowsDirtyGuardCommand.ts"
import { buildNativeCommand } from "./buildNativeCommand.ts"
import { quotePowerShell } from "./quotePowerShell.ts"

/** Build the PowerShell command that updates the Windows checkout and optionally runs a command. */
export function buildWindowsSyncCommand(
  /** The WIP branch to fetch and check out in Windows */
  wipBranch: string,
  /** The command and arguments to run after syncing */
  args: string[],
) {
  const remoteBranch = `origin/${wipBranch}`
  const fetchRefspec = `+refs/heads/${wipBranch}:refs/remotes/${remoteBranch}`
  const switchCommand = [
    `if (git show-ref --verify --quiet ${quotePowerShell(`refs/heads/${wipBranch}`)}) {`,
    `git switch ${quotePowerShell(wipBranch)}`,
    "} else {",
    `git switch --create ${quotePowerShell(wipBranch)} --track ${quotePowerShell(remoteBranch)}`,
    "}",
    ";",
    "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
  ].join(" ")

  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    `Set-Location -LiteralPath ${quotePowerShell(WINDOWS_REPO_PATH)}`,
    buildWindowsDirtyGuardCommand(),
    buildNativeCommand(["git", "fetch", "origin", fetchRefspec]),
    switchCommand,
    buildNativeCommand(["git", "merge", "--ff-only", remoteBranch]),
    ...(args.length > 0 ? [buildNativeCommand(args)] : []),
  ].join("; ")
}
