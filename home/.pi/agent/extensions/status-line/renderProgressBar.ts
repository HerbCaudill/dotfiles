import { PROGRESS_BAR_WIDTH } from "./constants.ts"

/** Render a segmented progress bar with an optional elapsed-time marker. */
export function renderProgressBar(
  /** The percentage to display. */
  percentage: number,
  /** Style the filled segments. */
  filledStyle: (text: string) => string,
  /** Style the empty segments. */
  emptyStyle: (text: string) => string,
  /** Style the percentage label. */
  labelStyle: (text: string) => string,
  /** Optional position for the elapsed-time marker. */
  timeMarkerPosition: number | null = null,
): string {
  const filled = Math.round((percentage / 100) * PROGRESS_BAR_WIDTH)
  const timePos =
    timeMarkerPosition !== null ? Math.round((timeMarkerPosition / 100) * PROGRESS_BAR_WIDTH) : null

  const bar = Array.from({ length: PROGRESS_BAR_WIDTH }, (_, index) => {
    const isFilled = index < filled
    const char = isFilled ? "▰" : "▱"
    const styledChar = isFilled ? filledStyle(char) : emptyStyle(char)

    if (timePos !== null && index === timePos && timePos < PROGRESS_BAR_WIDTH) {
      return `${styledChar}\u030C`
    }

    return styledChar
  }).join("")

  return `${bar} ${labelStyle(`${percentage}%`)}`
}
