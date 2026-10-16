/** Preserve readable JSONL records while replacing image, audio, and encrypted binary payloads. */
export function stripBinaryContent(
  /** Original harness record or nested content. */
  value: unknown,
): unknown {
  if (Array.isArray(value)) return value.map(stripBinaryContent)
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (["image", "image_url", "input_image", "output_image"].includes(String(record.type))) {
      return { type: "text", text: imageMarker }
    }
    if (["audio", "input_audio", "output_audio", "base64"].includes(String(record.type))) {
      return { type: "text", text: binaryMarker }
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, child]) => [
        key,
        key === "encrypted_content" ||
        (key === "blob" && typeof child === "string" && /^[A-Za-z0-9+/=\r\n]{512,}$/.test(child))
          ? binaryMarker
          : stripBinaryContent(child),
      ]),
    )
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (
      (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
      /"(?:image|input_image|output_image|encrypted_content|blob)"/.test(value)
    ) {
      try {
        return JSON.stringify(stripBinaryContent(JSON.parse(value)))
      } catch {
        // Tool text can resemble JSON without being a complete JSON value.
      }
    }
    return value.replace(/data:[\w.+/-]+;base64,[A-Za-z0-9+/=\r\n]+/g, binaryMarker)
  }
  return value
}

/** Explain where an omitted visual remains available. */
const imageMarker =
  "[Image omitted from shared text archive; available in the original transcript.]"
/** Mark non-text content without retaining opaque payloads. */
const binaryMarker =
  "[Binary payload omitted from shared text archive; available in the original transcript.]"
