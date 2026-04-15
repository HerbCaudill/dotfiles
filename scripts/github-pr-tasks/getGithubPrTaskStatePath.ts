import { homedir } from "node:os"
import { join } from "node:path"

/** Return the on-disk path for GitHub PR task sync state. */
export function getGithubPrTaskStatePath(): string {
  return join(homedir(), ".local", "share", "github-pr-task-sync", "state.json")
}
