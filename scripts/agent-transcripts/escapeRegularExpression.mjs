/** Escape regular expression metacharacters in a literal string. */
export const escapeRegularExpression = (
  /** The raw string that should be escaped. */
  value,
) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
