/** Get the current context usage percentage when Pi exposes it. */
export function getContextPercentage(
  /** Pi's context usage object. */
  usage: unknown,
): number | null {
  if (!usage || typeof usage !== "object") return null

  const record = usage as Record<string, unknown>
  const tokens = typeof record.tokens === "number" ? record.tokens : null
  const limit =
    typeof record.limit === "number" ? record.limit
    : typeof record.contextWindow === "number" ? record.contextWindow
    : typeof record.contextWindowSize === "number" ? record.contextWindowSize
    : null

  if (!tokens || !limit) return null

  return Math.max(0, Math.min(100, Math.round((tokens / limit) * 100)))
}
