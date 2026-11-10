/*
 * Turn a Jev dry-run results file into a Markdown report and an HTML report next to it.
 *
 * Usage: node --experimental-strip-types scripts/email-processing/renderJevDryRunReport.ts <dry-run.json>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  KEEP_THRESHOLD,
  MARKETING_THRESHOLD,
  RULE_CLASSIFICATIONS,
  decideFromJevAnswers,
  type JevDecision,
  type JevAnswers,
} from "./decideFromJevAnswers.ts"
import { scoreAgainstCorrections, DISPOSITIONS, type CorrectionStore } from "./jevCorrections.ts"
import { renderHtmlReport } from "./renderJevDryRunHtml.ts"
import type { ArchiveProtections, GmailCategory } from "./types.ts"

/** Read a results file, render both reports and print their paths. */
function main() {
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error("Pass the dry-run JSON file")
  const run = redecide(JSON.parse(readFileSync(inputPath, "utf8")) as DryRun)
  const correctionsPath = join(dirname(inputPath), "corrections.json")
  const corrections = existsSync(correctionsPath)
    ? (JSON.parse(readFileSync(correctionsPath, "utf8")) as CorrectionStore).corrections
    : {}
  const markdownPath = inputPath.replace(/\.json$/, ".md")
  const htmlPath = inputPath.replace(/\.json$/, ".html")
  writeFileSync(markdownPath, renderReport(run, corrections))
  writeFileSync(htmlPath, renderHtmlReport(run))
  console.log(markdownPath)
  console.log(htmlPath)
}

/**
 * Recompute each thread's decision from its stored Jev answers, so a report shows the current rules.
 * Runs made with an older question set keep the decisions they were made with.
 */
export function redecide(
  /** Dry-run results. */
  run: DryRun,
): DryRun {
  return {
    ...run,
    records: run.records.map(record =>
      "error" in record || !record.jev.answers.keep_in_inbox
        ? record
        : {
            ...record,
            decision: decideFromJevAnswers({
              answers: record.jev.answers,
              category: record.category as GmailCategory,
              senderAddress: record.sender.address,
              listId: record.listId,
              oneClickUnsubscribe: record.oneClickUnsubscribe,
              calendarMethod: record.calendarMethod ?? null,
              autoReply: record.autoReply ?? false,
              archiveProtections: record.archiveProtections as ArchiveProtections,
            }),
          },
    ),
  }
}

/** Render the whole report. */
export function renderReport(
  /** Dry-run results. */
  run: DryRun,
  /** Herb's corrections by message ID, for scoring. */
  corrections: CorrectionStore["corrections"] = {},
) {
  const records = run.records.filter((record): record is ClassifiedRecord => !("error" in record))
  const errors = run.records.filter(record => "error" in record)
  return [
    `# Jev dry run, ${run.createdAt.slice(0, 10)}`,
    `Read-only run over the last ${run.windowDays} days of ${run.account}. Nothing in Gmail was changed and nothing was unsubscribed. One decision per thread, for its newest message in the window, recomputed from Jev's stored answers with the current rules.`,
    renderSummary(run, records, errors.length),
    Object.keys(corrections).length > 0 ? renderScore(records, corrections) : "",
    renderMailKinds(records),
    renderKept(records),
    renderArchiveReasons(records),
    renderUnsubscribes(records),
    renderBlockedMarketing(records),
    renderAgreement(records, run.labelsSource),
    renderUncertain(records),
    renderSensitivity(records, corrections),
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
    `Rules: keep after an undone archive or for a calendar invitation; archive calendar replies, automatic replies and marketing (≥ ${MARKETING_THRESHOLD}); otherwise keep when Jev's keep-in-inbox answer is ≥ ${KEEP_THRESHOLD}, promoting it outside Primary, and archive the rest. Questions ${run.questionsVersion.slice(0, 19)}.`,
  ])
}

/** How the decisions compare with Herb's corrections. */
function renderScore(
  /** Classified records. */
  records: ClassifiedRecord[],
  /** Herb's corrections by message ID. */
  corrections: CorrectionStore["corrections"],
) {
  const score = scoreAgainstCorrections(records, corrections)
  const row = (entry: (typeof score.missedKeeps)[number]) => [
    entry.record.receivedAt.slice(0, 10),
    senderName(entry.record),
    link(truncate(entry.record.subject, 60), entry.record.gmailUrl),
    `${entry.predicted} (${entry.record.decision.classification})`,
    entry.expected,
    entry.record.jev.answers.keep_in_inbox?.noul.toFixed(2) ?? "–",
    entry.note,
  ]
  const headings = ["Received", "Sender", "Subject", "Job", "Herb", "Keep p", "Note"]
  return section("Agreement with Herb's corrections", [
    `${score.labeled} corrected threads. Keep or archive agrees on ${score.keepAgreement} (${percent(score.keepAgreement, score.labeled)}); the exact disposition on ${score.exactAgreement} (${percent(score.exactAgreement, score.labeled)}).`,
    table(
      ["Herb \\ job", ...DISPOSITIONS],
      score.confusion.map(row => [row.expected, ...DISPOSITIONS.map(key => row.predicted[key])]),
    ),
    `### Herb kept, the job archives (${score.missedKeeps.length})`,
    score.missedKeeps.length > 0 ? table(headings, score.missedKeeps.map(row)) : "None.",
    `### Herb archived, the job keeps (${score.wrongKeeps.length})`,
    score.wrongKeeps.length > 0 ? table(headings, score.wrongKeeps.map(row)) : "None.",
  ])
}

/** Threads the job would keep in the inbox. */
function renderKept(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const kept = records.filter(record => record.decision.decision !== "archive")
  return section(`Would keep (${kept.length})`, [
    kept.length > 0
      ? table(
          ["Received", "Sender", "Subject", "Category", "Action", "Reason", "Keep p"],
          kept.map(record => [
            record.receivedAt.slice(0, 10),
            senderName(record),
            link(truncate(record.subject, 60), record.gmailUrl),
            record.category,
            record.decision.decision === "promote" ? "promote" : "leave",
            record.decision.classification,
            record.jev.answers.keep_in_inbox?.noul.toFixed(2) ?? "–",
          ]),
        )
      : "None.",
  ])
}

/** Why the job archives what it archives. */
function renderArchiveReasons(
  /** Classified records. */
  records: ClassifiedRecord[],
) {
  const archived = records.filter(record => record.decision.decision === "archive")
  const rows = [...groupBy(archived, record => record.decision.classification).entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([classification, group]) => [
      classification,
      group.length,
      group
        .slice(0, 3)
        .map(record => truncate(record.subject, 40))
        .join("; "),
    ])
  return section(`Would archive (${archived.length})`, [
    rows.length > 0 ? table(["Reason", "Threads", "Examples"], rows) : "None.",
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
      !record.decision.unsubscribe.eligible && marketingProbability(record) >= MARKETING_THRESHOLD,
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

/**
 * How the keep threshold changes what is kept and, with corrections, how well it agrees with Herb.
 * Only threads Jev decides move; rule-decided threads keep their decision.
 */
function renderSensitivity(
  /** Classified records. */
  records: ClassifiedRecord[],
  /** Herb's corrections by message ID. */
  corrections: CorrectionStore["corrections"],
) {
  const decidedByJev = (record: ClassifiedRecord) =>
    !RULE_CLASSIFICATIONS.has(record.decision.classification)
  const keptAt = (record: ClassifiedRecord, threshold: number) =>
    decidedByJev(record)
      ? (record.jev.answers.keep_in_inbox?.noul ?? 0) >= threshold
      : record.decision.decision !== "archive"
  const labeled = records.filter(record => corrections[record.messageId]?.disposition)
  const herbKeeps = (record: ClassifiedRecord) =>
    ["leave", "promote"].includes(corrections[record.messageId].disposition ?? "")
  const rows = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(threshold => {
    const agree = labeled.filter(record => keptAt(record, threshold) === herbKeeps(record)).length
    return [
      threshold,
      records.filter(record => keptAt(record, threshold)).length,
      labeled.length > 0 ? `${agree} (${percent(agree, labeled.length)})` : "–",
      labeled.filter(record => herbKeeps(record) && !keptAt(record, threshold)).length,
      labeled.filter(record => !herbKeeps(record) && keptAt(record, threshold)).length,
    ]
  })
  return section("Keep threshold", [
    table(
      [
        "Keep at ≥",
        "Threads kept",
        "Agrees with Herb",
        "Herb kept, archived",
        "Herb archived, kept",
      ],
      rows,
    ),
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

export type ClassifiedRecord = {
  /** Gmail message ID. */
  messageId: string
  /** Gmail thread ID. */
  threadId: string
  /** Gmail link. */
  gmailUrl: string
  /** Labels at run time. */
  labelIds: string[]
  /** METHOD of an attached calendar invitation; missing in runs before it was recorded. */
  calendarMethod?: string | null
  /** Whether the message is an automatic reply; missing in runs before it was recorded. */
  autoReply?: boolean
  /** Raw List-Id header, or an empty string. */
  listId: string
  /** Whether the message offers RFC 8058 one-click unsubscribe. */
  oneClickUnsubscribe: boolean
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

export type DryRunRecord = ClassifiedRecord | { threadId: string; gmailUrl: string; error: string }

export type DryRun = {
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
