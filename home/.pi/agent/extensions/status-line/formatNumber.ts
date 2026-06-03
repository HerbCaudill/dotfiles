/** Format a token count with compact suffixes. */
export function formatNumber(
  /** The number to format. */
  num: number,
): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}
