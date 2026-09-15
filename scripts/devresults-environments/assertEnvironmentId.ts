/** Accept portable names that are safe in paths, Git refs and SQL identifiers. */
export function assertEnvironmentId(
  /** Candidate stable environment identity. */
  id: string,
): void {
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) ||
    id.length > 40 ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(id)
  )
    throw new Error(
      "Invalid environment ID: use 1–40 lowercase letters, digits and single hyphens, starting with a letter; Windows device names are reserved",
    )
}
