import type { ParsedArtifact, Participant } from "./types.ts"

/** Validate one convergence artifact and return its parsed metadata. */
export function validateArtifact(
  /** Complete artifact text. */
  contents: string,
  /** Expected identity from the active protocol state. */
  expected: {
    /** Participant publishing the artifact. */
    author: Participant
    /** Plan directory basename. */
    run: string
  },
): ParsedArtifact {
  validateCommonProblems(contents)

  const lines = contents.trimEnd().split("\n")
  const header = parseHeader(lines[0] ?? "")
  if (header.run !== expected.run) throw new Error(`Expected run ${expected.run}`)
  if (header.author !== expected.author) throw new Error(`Expected author ${expected.author}`)
  if (header.sequence < 1 || header.sequence > 6) throw new Error("Artifact round must be 001–006")

  const expectedEof = (lines[0] ?? "").replace(":artifact ", ":eof ")
  if (lines.at(-1) !== expectedEof) throw new Error("Artifact is missing its exact EOF marker")

  if (header.kind === "draft") {
    validateDraft(lines)
    return {
      author: header.author,
      filename: `draft-${padSequence(header.sequence)}.md`,
      kind: "draft",
      sequence: header.sequence,
    }
  }

  validateResponse(lines, header)
  const peer = header.author === "claude" ? "codex" : "claude"
  return {
    author: header.author,
    filename: `response-${padSequence(header.sequence)}-to-${peer}-draft-${padSequence(header.sequence)}.md`,
    kind: "response",
    sequence: header.sequence,
    verdict: header.verdict,
  }
}

/** Reject content patterns that usually mean an artifact was written incorrectly. */
function validateCommonProblems(contents: string) {
  let fence: string | undefined

  for (const line of contents.split("\n")) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0]
      fence = fence === marker ? undefined : marker
      continue
    }

    if (!fence && line.includes("\\n")) {
      throw new Error("Artifact contains a literal \\n sequence outside fenced code")
    }
    if (/^(<<<<<<<|=======|>>>>>>>)(?: |$)/.test(line)) {
      throw new Error("Artifact contains a conflict marker")
    }
  }
}

/** Parse the exact machine-readable artifact header. */
function parseHeader(line: string): Header {
  const draft = line.match(
    /^<!-- converge-plans:artifact run=([^ ]+) author=(claude|codex) kind=draft sequence=(\d{3}) -->$/,
  )
  if (draft) {
    return {
      author: draft[2] as Participant,
      kind: "draft",
      run: draft[1] ?? "",
      sequence: Number(draft[3]),
    }
  }

  const response = line.match(
    /^<!-- converge-plans:artifact run=([^ ]+) author=(claude|codex) kind=response sequence=(\d{3}) own-draft=(claude|codex)\/draft-(\d{3})\.md responds-to=(claude|codex)\/draft-(\d{3})\.md verdict=(revise|converged|round-limit) -->$/,
  )
  if (!response) throw new Error("Artifact header is malformed")

  const author = response[2] as Participant
  const peer = author === "claude" ? "codex" : "claude"
  const sequence = Number(response[3])
  if (response[4] !== author || Number(response[5]) !== sequence) {
    throw new Error("Response own-draft does not match its author and round")
  }
  if (response[6] !== peer || Number(response[7]) !== sequence) {
    throw new Error("Response responds-to does not match its peer and round")
  }

  return {
    author,
    kind: "response",
    run: response[1] ?? "",
    sequence,
    verdict: response[8] as ResponseVerdict,
  }
}

/** Validate the required planning headings in a standalone draft. */
function validateDraft(lines: string[]) {
  const headings = lines.filter(line => /^#{1,2} /.test(line))
  if (!headings[0]?.startsWith("# ") || headings[0].startsWith("# Response to ")) {
    throw new Error("Draft must start with a level-one plan title")
  }

  const required = ["## Goal", "## Approach", "## Tasks", "## Unresolved questions"]
  let priorIndex = 0
  for (const heading of required) {
    const index = headings.indexOf(heading)
    if (index <= priorIndex) throw new Error(`Draft must contain ${heading} in plan order`)
    priorIndex = index
  }
}

/** Validate response headings, round references, and verdict rules. */
function validateResponse(lines: string[], header: ResponseHeader) {
  const peer = header.author === "claude" ? "Codex" : "Claude"
  const sequence = padSequence(header.sequence)
  if (!lines.includes(`# Response to ${peer} draft ${sequence}`)) {
    throw new Error("The response heading does not match its peer and round")
  }

  const required = [
    `# Response to ${peer} draft ${sequence}`,
    "## Improvements to absorb",
    "## Suggestions not accepted",
    "## Remaining material differences",
    "## Verdict",
  ]
  let priorIndex = 0
  for (const heading of required) {
    const index = lines.indexOf(heading)
    if (index < priorIndex) throw new Error(`Response must contain ${heading} in protocol order`)
    priorIndex = index
  }

  if (!lines.includes(`\`${header.verdict}\``)) {
    throw new Error("Response verdict body does not match its metadata")
  }
  if (header.sequence < 5 && header.verdict === "round-limit") {
    throw new Error("round-limit is valid only in round 005")
  }
  if (header.sequence === 5 && header.verdict === "revise") {
    throw new Error("Round 005 must use converged or round-limit")
  }
  if (header.sequence === 6) throw new Error("Draft 006 has no response round")
}

/** Pad a numeric sequence to the artifact filename width. */
function padSequence(sequence: number) {
  return String(sequence).padStart(3, "0")
}

// TYPES

type Header = DraftHeader | ResponseHeader

type DraftHeader = {
  author: Participant
  kind: "draft"
  run: string
  sequence: number
}

type ResponseHeader = {
  author: Participant
  kind: "response"
  run: string
  sequence: number
  verdict: ResponseVerdict
}

type ResponseVerdict = "revise" | "converged" | "round-limit"
