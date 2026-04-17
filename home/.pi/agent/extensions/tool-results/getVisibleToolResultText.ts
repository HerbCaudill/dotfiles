import { getTextToolContent } from "./getTextToolContent.ts"
import type { ToolResultLike, VisibleToolResultTextOptions } from "./types.ts"

/** Return the text that should be visible for a tool result in the current expansion state. */
export function getVisibleToolResultText(
  /** The tool result to render. */
  result: ToolResultLike,
  /** Whether the row is expanded and whether the text should be trimmed. */
  options: VisibleToolResultTextOptions,
): string {
  if (!options.expanded) {
    return ""
  }

  const text = getTextToolContent(result)

  if (!text) {
    return ""
  }

  const visibleText = options.trim ? text.trim() : text

  if (!visibleText) {
    return ""
  }

  return `\n${visibleText}`
}
