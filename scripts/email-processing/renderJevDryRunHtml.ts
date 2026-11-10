import { readFileSync } from "node:fs"

import {
  ARCHIVE_THRESHOLD,
  PROMOTE_THRESHOLD,
  ROUTINE_AUTHENTICATION_THRESHOLD,
  MARKETING_THRESHOLD,
} from "./decideFromJevAnswers.ts"
import { dispositionOf, type CorrectionStore } from "./jevCorrections.ts"
import type { ClassifiedRecord, DryRun } from "./renderJevDryRunReport.ts"

/**
 * Render a self-contained HTML report for a Jev dry run. The page filters and groups threads in the
 * browser, so every subject line is one or two clicks from the summary. With review options, the page
 * also lets Herb record the correct disposition for each thread through the review server.
 */
export function renderHtmlReport(
  /** Dry-run results. */
  run: DryRun,
  /** Review mode: Herb's saved corrections. Omit for a read-only report. */
  options: { review?: { corrections: CorrectionStore } } = {},
) {
  const records = run.records.filter((record): record is ClassifiedRecord => !("error" in record))
  const errors = run.records.filter(record => "error" in record)
  const tokens = records.reduce((total, record) => total + record.jev.inputTokens, 0)
  const latencies = records.map(record => record.jev.latencyMs).sort((a, b) => a - b)
  const data = {
    summary: {
      createdAt: run.createdAt,
      windowDays: run.windowDays,
      account: run.account,
      labelsSource: run.labelsSource,
      receivedMessages: run.receivedMessages,
      threads: records.length,
      errors: errors.length,
      models: [...new Set(records.map(record => record.jev.model))],
      inputTokens: tokens,
      cost: (tokens / 1_000_000) * COST_PER_MILLION_TOKENS,
      latencyP50: percentile(latencies, 0.5),
      latencyP95: percentile(latencies, 0.95),
      thresholds: {
        marketing: MARKETING_THRESHOLD,
        archive: ARCHIVE_THRESHOLD,
        promote: PROMOTE_THRESHOLD,
        routineAuthentication: ROUTINE_AUTHENTICATION_THRESHOLD,
      },
    },
    records: records.map(toViewRecord),
    review: options.review
      ? {
          corrections: Object.fromEntries(
            Object.entries(options.review.corrections.corrections).map(([id, correction]) => [
              id,
              { disposition: correction.disposition, note: correction.note },
            ]),
          ),
        }
      : null,
    errors: errors.map(record => ({
      url: record.gmailUrl,
      error: "error" in record ? record.error : "",
    })),
  }
  const title = `Jev dry run, ${run.createdAt.slice(0, 10)}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<main id="app"><h1>${title}</h1><p>Loading…</p></main>
<script type="application/json" id="report-data">${toScriptJson(data)}</script>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>
`
}

/** Keep only what the page shows for one thread. */
function toViewRecord(
  /** Classified thread. */
  record: ClassifiedRecord,
) {
  const { answers } = record.jev
  return {
    id: record.messageId,
    jevDisposition: dispositionOf(record.decision),
    url: record.gmailUrl,
    receivedAt: record.receivedAt,
    name: record.sender.name,
    address: record.sender.address,
    subject: record.subject,
    category: record.category,
    inInbox: record.labelIds.includes("INBOX"),
    listId: record.listId,
    oneClick: record.oneClickUnsubscribe,
    kind: record.decision.mailKind,
    kinds: answers.mail_kind.probabilities,
    decision: record.decision.decision,
    classification: record.decision.classification,
    unsubscribe: record.decision.unsubscribe.eligible,
    blockedBy: record.decision.unsubscribe.blockedBy,
    protections: Object.entries(record.archiveProtections)
      .filter(([, value]) => value)
      .map(([name]) => name),
    coldType: answers.cold_type.choice,
    needsAttention: answers.needs_attention.noul,
    attentionReason: answers.attention_reason.choice,
    routineAuthentication: answers.routine_authentication.noul,
    label: record.label,
  }
}

/** Serialize data for a script element so no string inside it can close the element. */
function toScriptJson(
  /** Data to embed. */
  value: unknown,
) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029")
}

/** Nearest-rank percentile of ascending values. */
function percentile(
  /** Ascending values. */
  values: number[],
  /** Fraction from 0 to 1. */
  fraction: number,
) {
  return values.length === 0
    ? 0
    : values[Math.min(values.length - 1, Math.ceil(fraction * values.length) - 1)]
}

// CONSTANTS

const COST_PER_MILLION_TOKENS = 0.042

const STYLES = readFileSync(new URL("./jevDryRunReport.css", import.meta.url), "utf8")

const CLIENT_SCRIPT = readFileSync(new URL("./jevDryRunReport.client.js", import.meta.url), "utf8")
