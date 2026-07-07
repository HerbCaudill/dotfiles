/** Get the WIP branch for a feature branch. */
export function getWipBranch(
  /** The local branch name */
  branch: string,
) {
  const segments = branch.split("/")

  if (segments.length > 1 && segments[1] === "wip") return branch
  if (segments.length > 1) return [segments[0], "wip", ...segments.slice(1)].join("/")

  return `wip/${branch}`
}
