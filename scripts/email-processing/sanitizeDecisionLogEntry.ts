import type { DecisionLogEntry } from "./supervisorTypes.ts"

/** Redact sensitive material from every untrusted audit-log text field. */
export function sanitizeDecisionLogEntry(
  /** Complete decision record before persistence. */
  entry: DecisionLogEntry,
): DecisionLogEntry {
  const containsMedicalDetails =
    entry.classification === "medical-action" ||
    entry.policySignals.includes("medical-action") ||
    MEDICAL_DETAIL_PATTERN.test(`${entry.subject}\n${entry.reason}`)
  return {
    timestamp: entry.timestamp,
    messageId: entry.messageId,
    threadId: entry.threadId,
    sender: sanitizeSender(entry.sender),
    subject: containsMedicalDetails ? "[REDACTED MEDICAL DETAIL]" : sanitizeLogText(entry.subject),
    originalLabels: [...entry.originalLabels],
    decision: entry.decision,
    classification: entry.classification,
    confidence: entry.confidence,
    reason: containsMedicalDetails ? "[REDACTED MEDICAL DETAIL]" : sanitizeLogText(entry.reason),
    policySignals: entry.policySignals.map(value =>
      sanitizePolicySignal(value, containsMedicalDetails),
    ),
    gmailUrl: entry.gmailUrl,
  }
}

/** Preserve stable labels while redacting free-form medical signal details. */
function sanitizePolicySignal(
  /** Untrusted classifier policy signal. */
  value: string,
  /** Whether the surrounding decision is medical. */
  containsMedicalDetails: boolean,
): string {
  if (TRUSTED_POLICY_SIGNALS.has(value)) return sanitizeLogText(value, false)
  return containsMedicalDetails ? "[REDACTED MEDICAL DETAIL]" : sanitizeLogText(value)
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
  /** Whether medical context means the complete string is sensitive detail. */
  redactMedical = true,
): string {
  if (redactMedical && MEDICAL_DETAIL_PATTERN.test(value)) {
    return "[REDACTED MEDICAL DETAIL]"
  }
  return cleanControls(
    value
      .replace(AUTHENTICATION_CODE_PATTERN, "$1[REDACTED]")
      .replace(IBAN_PATTERN, "[REDACTED]")
      .replace(GROUPED_FINANCIAL_NUMBER_PATTERN, "[REDACTED]")
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
  /\b(?:diagnosis|diagnosed|medical|medication|prescription|test result|lab result|pathology|radiology|mri|blood pressure|treatment|therapy|pregnan\w*|cancer|hiv|hospital|clinic)\b/i

/** Authentication-code phrases whose following code must not reach the audit log. */
const AUTHENTICATION_CODE_PATTERN =
  /\b((?:(?:verification|authentication|security|login|one[- ]time)\s+)?(?:code|password|token|passcode|otp)\s*(?:is\s*)?[:#-]?\s*)([A-Z0-9][A-Z0-9-]{3,})\b/gi

/** IBAN-like account identifiers. */
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){10,30}\b/gi

/** Financial identifiers written as long digit sequences with spaces or hyphens. */
const GROUPED_FINANCIAL_NUMBER_PATTERN = /\b(?:\d[ -]?){6,}\d\b/g

/** Exact detail-free labels allowed through medical-context redaction. */
const TRUSTED_POLICY_SIGNALS = new Set(["medical-action", "retry", "routine"])
