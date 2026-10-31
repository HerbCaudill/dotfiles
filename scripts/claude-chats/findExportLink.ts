/** Get the export link from a "ready" email, only if it really came from Anthropic's mailer. */
export function findExportLink(
  /** Address from the email's From header. */
  senderAddress: string,
  /** Decoded email body. */
  body: string,
): string | null {
  if (!ANTHROPIC_SENDER.test(senderAddress)) return null
  return body.match(EXPORT_LINK)?.[0] ?? null
}

// CONSTANTS

const ANTHROPIC_SENDER = /^[^@\s]+@mail\.anthropic\.com$/i

const EXPORT_LINK = /https:\/\/claude\.ai\/export\/[0-9a-f-]{36}\/download\/[0-9a-f]+/
