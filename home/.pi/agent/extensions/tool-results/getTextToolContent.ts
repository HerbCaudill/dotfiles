import type { ToolResultLike } from "./types.ts"

/** Return the first text payload from a tool result. */
export function getTextToolContent(
  /** The tool result to inspect. */
  result: ToolResultLike,
): string | undefined {
  const textContent = result.content.find(content => content.type === "text")

  if (!textContent || !("text" in textContent)) {
    return undefined
  }

  return textContent.text
}
