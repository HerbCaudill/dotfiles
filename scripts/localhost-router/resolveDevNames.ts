import { execFileSync } from "node:child_process"
import { realpathSync } from "node:fs"
import { basename, resolve } from "node:path"

/** Resolve repository and worktree names for the public development addresses. */
export function resolveDevNames(
  /** Any directory within the checkout. */
  cwd: string,
) {
  /** Read Git metadata from this checkout without exposing configuration beyond the requested field. */
  const git = (
    /** Git arguments to read. */
    args: string[],
  ) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  const root = realpathSync(git(["rev-parse", "--show-toplevel"]))
  const commonDir = realpathSync(resolve(cwd, git(["rev-parse", "--git-common-dir"])))
  const gitDir = realpathSync(resolve(cwd, git(["rev-parse", "--git-dir"])))
  const mainRoot = git(["worktree", "list", "--porcelain", "-z"])
    .split("\0")
    .find(field => field.startsWith("worktree "))
    ?.slice(9)
  if (!mainRoot) throw new Error("Cannot find the repository's main checkout")
  let remote: string | undefined
  try {
    remote = git(["config", "--get", "remote.origin.url"])
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  const repository = remote
    ? basename(
        remote.includes("://")
          ? decodeURIComponent(new URL(remote).pathname)
          : remote.replace(/^[^/]*:/, ""),
      ).replace(/\.git$/, "")
    : basename(mainRoot)
  const repoName = hostnameLabel(repository)
  const worktreeName = gitDir === commonDir ? null : hostnameLabel(basename(root))
  const prefix = worktreeName ? `${worktreeName}.` : ""
  return {
    repoName,
    worktreeName,
    webName: `${prefix}${repoName}`,
    apiName: `${prefix}api.${repoName}`,
    commonDir,
  }
}

/** Convert a repository or folder name into one DNS label without truncating it. */
function hostnameLabel(
  /** Name taken from Git or the checkout path. */
  name: string,
) {
  const label = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!label || label.length > 63)
    throw new Error(
      `Cannot use "${name}" as a hostname label; choose a name of 1–63 letters, digits, or hyphens.`,
    )
  return label
}
