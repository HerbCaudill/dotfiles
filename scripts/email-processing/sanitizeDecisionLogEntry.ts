import type { DecisionLogEntry } from "./supervisorTypes.ts"

/** Redact sensitive material from every untrusted audit-log text field. */
export function sanitizeDecisionLogEntry(
  /** Complete decision record before persistence. */
  entry: DecisionLogEntry,
): DecisionLogEntry {
  return {
    timestamp: entry.timestamp,
    messageId: entry.messageId,
    threadId: entry.threadId,
    sender: sanitizeSender(entry.sender),
    subject: sanitizeLogText(entry.subject),
    originalLabels: [...entry.originalLabels],
    decision: entry.decision,
    classification: entry.classification,
    confidence: entry.confidence,
    reason: sanitizeLogText(entry.reason),
    policySignals: entry.policySignals.map(sanitizeLogText),
    gmailUrl: entry.gmailUrl,
  }
}

/** Sanitize a display name without changing the exact sender address. */
function sanitizeSender(
  /** Formatted sender name and address. */
  sender: string,
): string {
  const angleMatch = sender.match(/^(.*?)\s*<([^<>]+)>\s*$/)
  if (!angleMatch) return sender.includes("@") ? cleanControls(sender) : sanitizeLogText(sender)
  const displayName = sanitizeLogText(angleMatch[1].trim())
  return displayName
    ? `${displayName} <${cleanControls(angleMatch[2].trim())}>`
    : angleMatch[2].trim()
}

/** Remove credential-like and sensitive numeric material from audit text. */
function sanitizeLogText(
  /** Untrusted classifier or header text. */
  value: string,
): string {
  if (MEDICAL_DETAIL_PATTERN.test(value)) return "[REDACTED MEDICAL DETAIL]"
  return cleanControls(
    value
      .replace(/\b(?:sk|pk|api|token|secret)[-_][A-Za-z0-9_-]{8,}\b/gi, "[REDACTED]")
      .replace(/\b\d{4,}\b/g, "[REDACTED]")
      .replace(/\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "[REDACTED]"),
  )
}

/** Remove control characters and collapse whitespace. */
function cleanControls(
  /** Untrusted text. */
  value: string,
): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Terms that indicate the adjacent audit text itself contains medical detail. */
const MEDICAL_DETAIL_PATTERN =
  /\b(?:diagnosis|diagnosed|medical|medication|prescription|test result|lab result|treatment|therapy|pregnan\w*|cancer|hiv|hospital|clinic)\b/i
