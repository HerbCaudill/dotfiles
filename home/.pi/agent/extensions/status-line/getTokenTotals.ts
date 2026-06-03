/** Sum assistant token totals from the active session branch. */
export function getTokenTotals(
  /** The current session branch entries. */
  branch: readonly unknown[],
): { input: number; output: number } {
  return branch.reduce<{ input: number; output: number }>(
    (totals, entry) => {
      const message = getAssistantMessage(entry)
      const usage = message?.usage

      return {
        input: totals.input + getUsageNumber(usage, "input") + getUsageNumber(usage, "inputTokens"),
        output:
          totals.output + getUsageNumber(usage, "output") + getUsageNumber(usage, "outputTokens"),
      }
    },
    { input: 0, output: 0 },
  )
}

/** Extract an assistant message from a session branch entry. */
function getAssistantMessage(
  /** The session entry to inspect. */
  entry: unknown,
): { usage?: unknown } | null {
  if (!entry || typeof entry !== "object") return null

  const maybeEntry = entry as { type?: unknown; message?: unknown }
  if (maybeEntry.type !== "message") return null

  const message = maybeEntry.message as { role?: unknown; usage?: unknown } | undefined
  if (message?.role !== "assistant") return null

  return message
}

/** Read a numeric usage field from a provider usage object. */
function getUsageNumber(
  /** The provider usage object. */
  usage: unknown,
  /** The usage field to read. */
  field: string,
): number {
  if (!usage || typeof usage !== "object") return 0

  const value = (usage as Record<string, unknown>)[field]
  return typeof value === "number" ? value : 0
}
