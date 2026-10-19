/**
 * Print a scrawl bundle's moments with Whisper's wording in place of Apple's.
 *
 * Usage: node mergeScrawlTranscript.mts <bundle.scrawl> <whisper.json>
 *
 * The Whisper JSON must come from `mlx_whisper --word-timestamps True --output-format json` run on
 * the bundle's `audio.wav`, which shares the bundle's clock. Each moment's text starts where
 * scrawl's own text for it starts, so the split matches `summary.md`. Whisper words with no Apple
 * word nearby are dropped as hallucinations from silence.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

const [bundlePath, whisperPath] = process.argv.slice(2)
if (!bundlePath || !whisperPath) {
  console.error("Usage: node mergeScrawlTranscript.mts <bundle.scrawl> <whisper.json>")
  process.exit(1)
}

const bundle = JSON.parse(readFileSync(path.join(bundlePath, "scrawl.json"), "utf8")) as Bundle
const whisper = JSON.parse(readFileSync(whisperPath, "utf8")) as Whisper

const toleranceMs = 1500
const appleWords = bundle.transcript.words
const whisperWords = whisper.segments
  .flatMap(segment => segment.words ?? [])
  .map(word => ({ t0: word.start * 1000, t1: word.end * 1000, text: word.word.trim() }))
  .filter(word => appleWords.some(apple => apple.t1 > word.t0 - toleranceMs && apple.t0 < word.t1 + toleranceMs))

const moments = findMomentStarts(bundle.keyframes, appleWords)

for (const [index, moment] of moments.entries()) {
  const end = moments[index + 1]?.start ?? Infinity
  const said = whisperWords
    .filter(word => (word.t0 + word.t1) / 2 >= moment.start && (word.t0 + word.t1) / 2 < end)
    .map(word => word.text)
    .join(" ")
    .replace(/ (?=[,.;:!?])/g, "")
  const action = moment.keyframe.reason === "click" ? " [clicked]" : moment.keyframe.reason === "mark" ? " [drew]" : ""
  console.log(`- #${moment.keyframe.index} (${formatTime(moment.keyframe.t)})${action} ${moment.keyframe.file}`)
  if (said) console.log(`  Whisper: “${said}”`)
  if (moment.keyframe.said && normalize(moment.keyframe.said) !== normalize(said))
    console.log(`  Apple:   “${moment.keyframe.said}”`)
}

/**
 * Find where each moment's narration starts, by walking Apple's words through each moment's text.
 * A boundary sits midway through the pause before the moment's first word, so Whisper's slightly
 * different word times still land on the right side of it.
 */
function findMomentStarts(keyframes: Keyframe[], words: Word[]) {
  let next = 0
  return keyframes.map(keyframe => {
    if (!keyframe.said) return { keyframe, start: keyframe.t }
    const first = words[next]
    const previous = words[next - 1]
    const start = first ? (previous ? (previous.t1 + first.t0) / 2 : first.t0 - toleranceMs) : keyframe.t
    next += keyframe.said.split(/\s+/).filter(Boolean).length
    return { keyframe, start }
  })
}

/** Format milliseconds as M:SS. */
function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** Reduce text to lowercase words, to compare two transcripts. */
function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim()
}

type Word = { t0: number; t1: number; text: string }
type Keyframe = { index: number; t: number; reason: string; file: string; said?: string }
type Bundle = { keyframes: Keyframe[]; transcript: { source: string; words: Word[] } }
type Whisper = { segments: { words?: { word: string; start: number; end: number }[] }[] }
