import { spawnSync } from "node:child_process"
import { runCommand } from "./runCommand.ts"

/** Rebase this machine's snapshot onto the shared branch and publish with bounded race retries. */
export const syncArchiveRemote = (
  /** Working archive repository with an origin remote. */
  archiveRepositoryPath: string,
) => {
  const options = { cwd: archiveRepositoryPath, timeout: 300_000 }
  runCommand("git", ["fetch", "origin"], options)
  if (
    spawnSync("git", ["rev-parse", "--verify", "refs/remotes/origin/main"], options).status === 0
  ) {
    runCommand("git", ["rebase", "origin/main"], options)
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const push = spawnSync("git", ["push", "-u", "origin", "HEAD:main"], {
      ...options,
      encoding: "utf8",
    })
    if (push.status === 0) return
    if (!/\[rejected\].*(fetch first|non-fast-forward)/.test(push.stderr ?? "") || attempt === 2) {
      throw new Error(push.error?.message ?? push.stderr?.trim() ?? "Archive push failed")
    }
    runCommand("git", ["fetch", "origin", "main"], options)
    runCommand("git", ["rebase", "origin/main"], options)
  }
}
