import { escapeRegularExpression } from "./escapeRegularExpression.mjs"

/** Insert or replace a named managed block in a text file. */
export const upsertManagedBlock = (
  /** The existing file contents, if any. */
  { blockBody, existingContents, name },
) => {
  const beginMarker = `# BEGIN ${name}`
  const endMarker = `# END ${name}`
  const managedBlock = [beginMarker, blockBody, endMarker].join("\n")

  const blockPattern = new RegExp(
    `${escapeRegularExpression(beginMarker)}\\n[\\s\\S]*?\\n${escapeRegularExpression(endMarker)}`,
    "m",
  )
  const normalizedContents = existingContents.trimEnd()

  if (blockPattern.test(normalizedContents)) {
    return `${normalizedContents.replace(blockPattern, managedBlock)}\n`
  }

  if (normalizedContents.length === 0) {
    return `${managedBlock}\n`
  }

  return `${normalizedContents}\n\n${managedBlock}\n`
}
