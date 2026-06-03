/** Calculate the percentage elapsed in a seven-day usage window. */
export function getWeekProgress(
  /** The reset timestamp returned by the usage API. */
  resetsAt: string,
): number {
  const now = Date.now()
  const resetTime = new Date(resetsAt).getTime()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const startTime = resetTime - weekMs
  const elapsed = now - startTime
  const progress = (elapsed / weekMs) * 100

  return Math.max(0, Math.min(100, Math.round(progress)))
}
