/** Get the theme color for usage pace compared with elapsed time. */
export function getUsageRatioColor(
  /** The usage percentage. */
  usagePct: number,
  /** The elapsed percentage of the usage window. */
  elapsedPct: number,
): "success" | "warning" | "error" {
  if (elapsedPct === 0) return "success"

  const ratio = usagePct / elapsedPct
  if (ratio < 0.9) return "success"
  if (ratio <= 1.1) return "warning"
  return "error"
}
