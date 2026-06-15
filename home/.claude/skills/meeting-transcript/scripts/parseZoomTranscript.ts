#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { argv, exit, stderr, stdout } from "node:process"

/** Parse a Zoom-style Markdown transcript and print structured JSON. */
export function parseZoomTranscript(
  /** The raw transcript file path. */
  sourcePath: string,
  /** The raw Markdown transcript contents. */
  content: string,
): ParsedTranscript {
  const { metadata, body } = parseFrontmatter(content)
  const rawTurns = parseRawTurns(body)
  const participants = buildParticipants(rawTurns.map(turn => turn.speakerLabel))
  const displayNameByLabel = new Map(
    participants.map(participant => [participant.name, participant.displayName]),
  )
  const turns = mergeAdjacentTurns(
    rawTurns.map(turn => ({
      ...turn,
      speaker: displayNameByLabel.get(turn.speakerLabel) ?? turn.speakerLabel,
    })),
  )

  return {
    sourcePath,
    filename: basename(sourcePath),
    metadata,
    participants,
    turns,
  }
}

/** Split optional YAML frontmatter from the transcript body. */
function parseFrontmatter(
  /** The raw Markdown transcript contents. */
  content: string,
): { metadata: Record<string, string>; body: string } {
  if (!content.startsWith("---\n")) return { metadata: {}, body: content }

  const endIndex = content.indexOf("\n---", 4)
  if (endIndex === -1) return { metadata: {}, body: content }

  return {
    metadata: parseYamlScalars(content.slice(4, endIndex)),
    body: content.slice(endIndex + 4).replace(/^\s+/, ""),
  }
}

/** Parse simple YAML scalar frontmatter fields used by Zoom imports. */
function parseYamlScalars(
  /** The frontmatter text without delimiters. */
  frontmatter: string,
): Record<string, string> {
  return Object.fromEntries(
    frontmatter
      .split("\n")
      .map(line => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map(match => [match[1], unquoteYamlScalar(match[2].trim())]),
  )
}

/** Remove matching single or double quotes from a YAML scalar. */
function unquoteYamlScalar(
  /** The raw scalar value. */
  value: string,
): string {
  if (value.length < 2) return value

  const first = value.at(0)
  const last = value.at(-1)
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1)

  return value
}

/** Parse timestamped Zoom transcript lines into raw turns. */
function parseRawTurns(
  /** The Markdown body after frontmatter. */
  body: string,
): RawTurn[] {
  return body
    .split("\n")
    .map(line => line.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})]\s+([^:]+):\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map(match => ({ timestamp: match[1], speakerLabel: match[2].trim(), text: match[3].trim() }))
}

/** Build ordered participants with first-name display names unless they collide. */
function buildParticipants(
  /** Speaker labels in transcript order. */
  speakerLabels: string[],
): Participant[] {
  const uniqueLabels = [...new Set(speakerLabels)]
  const firstNameCounts = uniqueLabels.reduce<Record<string, number>>(
    (counts, label) => ({ ...counts, [firstName(label)]: (counts[firstName(label)] ?? 0) + 1 }),
    {},
  )

  return uniqueLabels.map(label => ({
    name: label,
    displayName: firstNameCounts[firstName(label)] === 1 ? firstName(label) : label,
  }))
}

/** Get a speaker label's first token. */
function firstName(
  /** The speaker label. */
  label: string,
): string {
  return label.trim().split(/\s+/)[0] ?? label
}

/** Merge consecutive turns from the same normalized speaker. */
function mergeAdjacentTurns(
  /** Parsed turns with normalized speaker names. */
  turns: Turn[],
): Turn[] {
  return turns.reduce<Turn[]>((merged, turn) => {
    const previous = merged.at(-1)
    if (
      !previous ||
      previous.speaker !== turn.speaker ||
      previous.speakerLabel !== turn.speakerLabel
    )
      return [...merged, turn]

    return [...merged.slice(0, -1), { ...previous, text: `${previous.text} ${turn.text}`.trim() }]
  }, [])
}

/** Print usage and exit with an error. */
function fail(
  /** The error message to print. */
  message: string,
): never {
  stderr.write(`${message}\nUsage: node parseZoomTranscript.ts /path/to/raw-transcript.md\n`)
  exit(1)
}

const sourcePath = argv[2]
if (!sourcePath) fail("Missing transcript path.")

const transcript = parseZoomTranscript(sourcePath, readFileSync(sourcePath, "utf8"))
stdout.write(`${JSON.stringify(transcript, null, 2)}\n`)

/** A participant inferred from Zoom speaker labels. */
type Participant = {
  /** The original Zoom speaker label. */
  name: string
  /** The normalized speaker name to use in generated notes. */
  displayName: string
}

/** A raw parsed turn before display name normalization. */
type RawTurn = {
  /** The first timestamp for this raw line. */
  timestamp: string
  /** The original Zoom speaker label. */
  speakerLabel: string
  /** The line text. */
  text: string
}

/** A normalized transcript turn. */
type Turn = RawTurn & {
  /** The normalized speaker display name. */
  speaker: string
}

/** The structured transcript emitted by this parser. */
type ParsedTranscript = {
  /** The raw transcript path provided by the caller. */
  sourcePath: string
  /** The raw transcript filename. */
  filename: string
  /** Parsed scalar frontmatter from the raw transcript. */
  metadata: Record<string, string>
  /** Participants inferred from speaker labels. */
  participants: Participant[]
  /** Chronological speaker turns with adjacent same-speaker lines merged. */
  turns: Turn[]
}
