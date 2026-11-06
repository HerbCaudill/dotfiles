/*
 * Turn a Jev dry-run results file into a Markdown report next to it.
 *
 * Usage: node --experimental-strip-types scripts/email-processing/renderJevDryRunReport.ts <dry-run.json>
 */
import { readFileSync, writeFileSync } from "node:fs"

import {
  ARCHIVE_THRESHOLD,
  PROMOTE_THRESHOLD,
  ROUTINE_AUTHENTICATION_THRESHOLD,
  UNSUBSCRIBE_THRESHOLD,
  type JevDecision,
  type JevAnswers,
} from "./decideFromJevAnswers.ts"

/** Read a results file, render the report and print its path. */
function main() {
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error("Pass the dry-run JSON file")
  const run = JSON.parse(readFileSync(inputPath, "utf8")) as DryRun
  const outputPath = inputPath.replace(/\.json$/, ".md")
  writeFileSync(outputPath, renderReport(run))
  console.log(outputPath)
}

/** Render the whole report. */
export function renderReport(
  /** Dry-run results. */
  run: DryRun,
) {
  const records = run.records.filter((record): record is ClassifiedRecord => !("error" in record))
  const errors = run.records.filter(record => "error" in record)
  return [
    `# Jev dry run, ${run.createdAt.slice(0, 10)}`,
    `Read-only run over the last ${run.windowDays} days of ${run.account}. Nothing in Gmail was changed and nothing was unsubscribed. One decision per thread, for its newest message in the window.`,
    renderSummary(run, records, errors.length),
    renderMailKinds(records),
    renderUnsubscribes(records),
    renderBlockedMarketing(records),
    renderArchives(records),
    renderPromotions(records),
    renderAgreement(records, run.labelsSource),
    renderUncertain(records),
    renderSensitivity(records),
    errors.length > 0 ? renderErrors(errors) : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .concat("\n")
}

/** Counts, cost and latency. */
function renderSummary(
  /** Dry-run results. */
  run: DryRun,
  /** Classified records. */
  records: ClassifiedRecord[],
  /** Number of failed records. */
  errorCount: number,
) {
  const tokens = sum(records.map(record => record.jev.inputTokens))
  const latencies = records
    .map(record => record.jev.latencyMs)
    .slice()
    .sort((a, b) => a - b)
  const count = (decision: JevDecision["decision"]) =>
    records.filter(record => record.decision.decision === decision).length
  return section("Summary", [
    table(
      ["Measure", "Value"],
      [
        ["Messages received", run.receivedMessages],
        ["Threads classified", records.length],
        ["Errors", errorCount],
        ["Would archive", count("archive")],
        ["Would promote", count("promote")],
        ["Would leave alone", count("none")],
        [
          "Would unsubscribe (messages)",
          records.filter(record => record.decision.unsubscribe.eligible).length,
        ],
        [
          "Would unsubscribe (senders)",
          uniqueSenders(records.filter(record => record.decision.unsubscribe.eligible)).length,
        ],
        ["Model", [...new Set(records.map(record => record.jev.model))].join(", ")],
        ["Input tokens", tokens.toLocaleString("en-US")],
        ["Cost at $0.042 per million", `$${((tokens / 1_000_000) * 0.042).toFixed(4)}`],
        [
          "Latency p50 / p95",
          `${percentile(latencies, 0.5)} ms / ${percentile(latencies, 0.95)} ms`,
        ],
      ],
    ),
    `Thresholds: unsubscribe at marketing ≥ ${UNSUBSCRIBE_THRESHOLD}, archive at ≥ ${ARCHIVE_THRESHOLD}, promote at needs-attention ≥ ${PROMOTE_THRESHOLD} unless routine authentication ≥ ${ROUTINE_AUTHENTICATION_THRESHOLD}. Questions ${run.questionsVersion.slice(0, 19)}.`,
  ])
}

/** Distribution of mail kinds and how sure Jev was. */
function renderMailKinds(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const groups = groupBy(records, record => record.decision.mailKind)
  const rows = [...groups.entries()]
    .slice()
    .sort((a, b) => b[1].length - a[1].length)
    .map(([kind, group]) => [
      kind,
      group.length,
      percent(group.length, records.length),
      group.filter(record => topProbability(record.jev.answers) < 0.6).length,
      uniqueSenders(group).length,
    ])
  return section("Mail kinds", [
    table(["Kind", "Threads", "Share", "Uncertain (top < 0.6)", "Senders"], rows),
  ])
}

/** Senders the job would unsubscribe from. */
function renderUnsubscribes(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const eligible = records.filter(record => record.decision.unsubscribe.eligible)
  const rows = [...groupBy(eligible, record => record.sender.address).entries()]
    .slice()
    .sort((a, b) => b[1].length - a[1].length)
    .map(([address, group]) => [
      senderName(group[0]),
      address,
      group.length,
      Math.min(...group.map(record => marketingProbability(record))).toFixed(2),
      labelText(group[0].label),
      truncate(group[0].subject, 60),
    ])
  return section(`Would unsubscribe (${rows.length} senders)`, [
    rows.length > 0
      ? table(
          [
            "Sender",
            "Address",
            "Threads",
            "Lowest marketing p",
            "Your earlier label",
            "Example subject",
          ],
          rows,
        )
      : "None.",
  ])
}

/** Marketing that was not eligible, and why. */
function renderBlockedMarketing(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const blocked = records.filter(
    record =>
      !record.decision.unsubscribe.eligible &&
      marketingProbability(record) >= UNSUBSCRIBE_THRESHOLD,
  )
  const reasons = groupBy(
    blocked.flatMap(record =>
      record.decision.unsubscribe.blockedBy.map(reason => ({ reason, record })),
    ),
    entry => entry.reason,
  )
  const rows = [...reasons.entries()].map(([reason, entries]) => [
    reason,
    entries.length,
    uniqueSenders(entries.map(entry => entry.record))
      .slice(0, 8)
      .join(", "),
  ])
  return section("Marketing the job would not unsubscribe from", [
    rows.length > 0 ? table(["Blocked by", "Threads", "Senders (first 8)"], rows) : "None.",
  ])
}

/** Threads the job would archive. */
function renderArchives(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const archives = records.filter(record => record.decision.decision === "archive")
  return section(`Would archive (${archives.length})`, [
    archives.length > 0
      ? table(
          ["Received", "Sender", "Subject", "Category", "Classification", "p", "Now in Inbox"],
          archives.map(record => [
            record.receivedAt.slice(0, 10),
            senderName(record),
            link(truncate(record.subject, 60), record.gmailUrl),
            record.category,
            record.decision.classification,
            (record.jev.answers.mail_kind.probabilities[record.decision.mailKind] ?? 0).toFixed(2),
            record.labelIds.includes("INBOX") ? "yes" : "no",
          ]),
        )
      : "None.",
  ])
}

/** Threads the job would promote to Primary. */
function renderPromotions(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const promotions = records.filter(record => record.decision.decision === "promote")
  return section(`Would promote (${promotions.length})`, [
    promotions.length > 0
      ? table(
          ["Received", "Sender", "Subject", "Category", "Reason", "Needs attention p"],
          promotions.map(record => [
            record.receivedAt.slice(0, 10),
            senderName(record),
            link(truncate(record.subject, 60), record.gmailUrl),
            record.category,
            record.decision.classification,
            record.jev.answers.needs_attention.noul.toFixed(2),
          ]),
        )
      : "None.",
  ])
}

/** Compare Jev's marketing judgment with the sender labels from the agent review Herb approved. */
function renderAgreement(
  /** Classified records. */
  records: ClassifiedRecord[],
  /** Where the labels came from. */
  source: string | null,
) {
  const labeled = records.filter(record => record.label)
  if (labeled.length === 0)
    return section("Agreement with earlier labels", ["No labeled senders in this window."])
  const senders = [...groupBy(labeled, record => record.sender.address).entries()].map(
    ([address, group]) => {
      const marketingShare =
        group.filter(record => record.decision.mailKind === "marketing").length / group.length
      return {
        address,
        group,
        expected: group[0].label!,
        jev: marketingShare >= 0.5 ? "marketing" : "not-marketing",
      }
    },
  )
  const cell = (expected: string, jev: string) =>
    senders.filter(sender => sender.expected === expected && sender.jev === jev).length
  const disagreements = senders.filter(sender => sender.expected !== sender.jev)
  return section("Agreement with earlier labels", [
    `Labels: ${source ?? "unknown"}. Compared per sender: Jev counts a sender as marketing when most of its threads come back as marketing.`,
    table(
      ["", "Jev: marketing", "Jev: not marketing"],
      [
        ["Labeled marketing", cell("marketing", "marketing"), cell("marketing", "not-marketing")],
        [
          "Labeled not marketing",
          cell("not-marketing", "marketing"),
          cell("not-marketing", "not-marketing"),
        ],
      ],
    ),
    `Agreement: ${percent(senders.length - disagreements.length, senders.length)} of ${senders.length} senders.`,
    disagreements.length > 0
      ? table(
          ["Sender", "Label", "Jev mail kinds", "Example subject"],
          disagreements.map(sender => [
            `${senderName(sender.group[0])} (${sender.address})`,
            sender.expected,
            countKinds(sender.group),
            truncate(sender.group[0].subject, 60),
          ]),
        )
      : "",
  ])
}

/** Threads where Jev spread its probability across kinds. */
function renderUncertain(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const uncertain = records
    .filter(record => topProbability(record.jev.answers) < 0.6)
    .slice()
    .sort((a, b) => topProbability(a.jev.answers) - topProbability(b.jev.answers))
  return section(`Uncertain mail kind (${uncertain.length})`, [
    uncertain.length > 0
      ? table(
          ["Sender", "Subject", "Top two kinds"],
          uncertain.slice(0, 40).map(record => [
            senderName(record),
            link(truncate(record.subject, 60), record.gmailUrl),
            Object.entries(record.jev.answers.mail_kind.probabilities)
              .slice()
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([kind, probability]) => `${kind} ${probability.toFixed(2)}`)
              .join(", "),
          ]),
        )
      : "None.",
    uncertain.length > 40 ? `Showing the 40 least certain of ${uncertain.length}.` : "",
  ])
}

/** How the main counts change with the thresholds. */
function renderSensitivity(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const unsubscribeBase = records.filter(record =>
    record.decision.unsubscribe.blockedBy.every(reason => reason === "not-marketing"),
  )
  const rows = [0.6, 0.7, 0.8, 0.9, 0.95].map(threshold => [
    threshold,
    uniqueSenders(unsubscribeBase.filter(record => marketingProbability(record) >= threshold))
      .length,
    records.filter(
      record =>
        Object.values(record.archiveProtections).every(value => !value) &&
        (record.jev.answers.mail_kind.probabilities.cold_outreach ?? 0) >= threshold,
    ).length,
    records.filter(
      record =>
        record.category !== "primary" &&
        record.jev.answers.needs_attention.noul >= threshold &&
        record.jev.answers.routine_authentication.noul < ROUTINE_AUTHENTICATION_THRESHOLD,
    ).length,
  ])
  return section("Threshold sensitivity", [
    table(["Threshold", "Unsubscribe senders", "Cold outreach archives", "Promotions"], rows),
  ])
}

/** Failed records. */
function renderErrors(
  /** Records with errors. */
  errors: DryRunRecord[],
) {
  return section(`Errors (${errors.length})`, [
    table(
      ["Thread", "Error"],
      errors.map(record => [
        link(record.threadId, record.gmailUrl),
        truncate("error" in record ? record.error : "", 120),
      ]),
    ),
  ])
}

/** Group items by a key, keeping first-seen order. */
function groupBy<T, K>(
  /** Items to group. */
  items: readonly T[],
  /** Key for each item. */
  keyOf: (item: T) => K,
) {
  const groups = new Map<K, T[]>()
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item])
  return groups
}

/** Render a titled section. */
function section(
  /** Heading. */
  title: string,
  /** Paragraphs and tables. */
  parts: string[],
) {
  return [`## ${title}`, ...parts.filter(Boolean)].join("\n\n")
}

/** Render a Markdown table. */
function table(
  /** Column headings. */
  headings: string[],
  /** Row values. */
  rows: (string | number)[][],
) {
  const line = (cells: (string | number)[]) =>
    `| ${cells.map(cell => String(cell).replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`
  return [line(headings), line(headings.map(() => "---")), ...rows.map(line)].join("\n")
}

/** Render a Markdown link. */
function link(
  /** Link text. */
  text: string,
  /** Target URL. */
  url: string,
) {
  return `[${text.replaceAll("[", "(").replaceAll("]", ")")}](${url})`
}

/** Shorten text for a table cell. */
function truncate(
  /** Text. */
  text: string,
  /** Maximum length. */
  length: number,
) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

/** Display name, falling back to the address. */
function senderName(
  /** Record. */
  record: ClassifiedRecord,
) {
  return record.sender.name || record.sender.address
}

/** Unique sender addresses among records. */
function uniqueSenders(
  /** Records. */
  records: ClassifiedRecord[],
) {
  return [...new Set(records.map(record => record.sender.address))]
}

/** Jev's probability that a record is marketing. */
function marketingProbability(
  /** Record. */
  record: ClassifiedRecord,
) {
  return record.jev.answers.mail_kind.probabilities.marketing ?? 0
}

/** Highest mail-kind probability. */
function topProbability(
  /** Jev answers. */
  answers: JevAnswers,
) {
  return Math.max(...Object.values(answers.mail_kind.probabilities))
}

/** Summarize the mail kinds Jev gave a sender's threads. */
function countKinds(
  /** Records for one sender. */
  records: ClassifiedRecord[],
) {
  return [...groupBy(records, record => record.decision.mailKind).entries()]
    .map(([kind, group]) => `${kind} ×${group.length}`)
    .join(", ")
}

/** Describe an earlier label. */
function labelText(
  /** Label or null. */
  label: ClassifiedRecord["label"],
) {
  return label ?? "–"
}

/** Format a share as a percentage. */
function percent(
  /** Part. */
  part: number,
  /** Whole. */
  whole: number,
) {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`
}

/** Sum numbers. */
function sum(
  /** Values. */
  values: number[],
) {
  return values.reduce((total, value) => total + value, 0)
}

/** Nearest-rank percentile of sorted values. */
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

// TYPES

type ClassifiedRecord = {
  /** Gmail message ID. */
  messageId: string
  /** Gmail thread ID. */
  threadId: string
  /** Gmail link. */
  gmailUrl: string
  /** Labels at run time. */
  labelIds: string[]
  /** Receipt time. */
  receivedAt: string
  /** Sender. */
  sender: { name: string; address: string }
  /** Subject with codes redacted. */
  subject: string
  /** Gmail category. */
  category: string
  /** Deterministic protections. */
  archiveProtections: Record<string, boolean>
  /** Jev output. */
  jev: { model: string; inputTokens: number; latencyMs: number; answers: JevAnswers }
  /** What the job would do. */
  decision: JevDecision
  /** Earlier sender label, if any. */
  label: "marketing" | "not-marketing" | null
}

type DryRunRecord = ClassifiedRecord | { threadId: string; gmailUrl: string; error: string }

type DryRun = {
  /** Run time. */
  createdAt: string
  /** Window length. */
  windowDays: number
  /** Mailbox. */
  account: string
  /** Content hash of the Jev questions. */
  questionsVersion: string
  /** Where sender labels came from. */
  labelsSource: string | null
  /** Messages received in the window. */
  receivedMessages: number
  /** Threads in the window. */
  threads: number
  /** One record per thread. */
  records: DryRunRecord[]
}

if (import.meta.main) main()
