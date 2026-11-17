/**
 * Undo the .gitignore entries that `vercel link` appends, except `.vercel`. The CLI adds env
 * patterns that would also ignore committed files such as `.env.example`.
 */
export const guardGitignore = (
  /** The .gitignore before `vercel link` ran, or undefined if there was none. */
  before: string | undefined,
  /** The .gitignore after `vercel link` ran. */
  after: string,
): GitignoreGuard => {
  const original = before ?? ""
  const existing = new Set(lines(original))
  const added = lines(after).filter(line => !existing.has(line) && !line.startsWith("#"))
  const addsVercel = added.some(isVercelEntry) && ![...existing].some(isVercelEntry)
  const dropped = [...new Set(added.filter(line => !isVercelEntry(line)))]
  if (!addsVercel) return { content: original, dropped }

  const separator = original === "" || original.endsWith("\n") ? "" : "\n"
  return { content: `${original}${separator}.vercel\n`, dropped }
}

/** Split a file into trimmed, non-blank lines. */
const lines = (
  /** The file contents. */
  text: string,
) =>
  text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)

/** Whether a .gitignore line ignores the `.vercel` directory. */
const isVercelEntry = (
  /** A trimmed .gitignore line. */
  line: string,
) => /^\/?\.vercel\/?$/.test(line)

/** The .gitignore to write back, and the entries left out of it. */
type GitignoreGuard = {
  /** The guarded file contents. */
  content: string
  /** Entries `vercel link` added that were removed. */
  dropped: string[]
}
