/** Build the PowerShell command that refuses to run when the Windows checkout is dirty. */
export function buildWindowsDirtyGuardCommand() {
  return [
    "$status = git status --porcelain",
    "if ($status) { [Console]::Out.WriteLine('drsync: Windows checkout has uncommitted changes; commit, stash, or clean it before drsync.'); [Console]::Out.WriteLine($status); exit 2 }",
  ].join("; ")
}
