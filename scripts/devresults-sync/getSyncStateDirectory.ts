import { join } from "node:path"

/** Get the state directory for a repository's background sync. */
export function getSyncStateDirectory(
  /** The repository root path */
  repoRoot: string,
  /** Environment variables */
  env: NodeJS.ProcessEnv = process.env,
) {
  const stateRoot = env.XDG_STATE_HOME ?? join(env.HOME ?? ".", ".local", "state")
  const key = repoRoot.replaceAll(/[^A-Za-z0-9._-]/g, "-").replaceAll(/^-+|-+$/g, "")

  return join(stateRoot, "drsync", `drsync-${key}`)
}
