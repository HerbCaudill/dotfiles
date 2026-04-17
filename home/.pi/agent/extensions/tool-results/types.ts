/** A text or binary payload returned by a tool renderer. */
export type ToolContentPart =
  | {
      /** The payload kind. */
      type: "text"
      /** The tool output text. */
      text: string
    }
  | {
      /** The payload kind. */
      type: string
    }

/** A minimal tool result shape consumed by the renderer helpers. */
export type ToolResultLike = {
  /** The ordered tool payloads. */
  content: ToolContentPart[]
}

/** Options that control how much tool output is shown. */
export type VisibleToolResultTextOptions = {
  /** Whether the tool row is currently expanded. */
  expanded: boolean
  /** Whether leading and trailing whitespace should be trimmed first. */
  trim?: boolean
}
