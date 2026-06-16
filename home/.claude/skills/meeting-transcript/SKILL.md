---
name: meeting-transcript
description: Use when turning a raw Zoom-style meeting transcript path or natural-language meeting reference into a cleaned transcript, meeting summary, agenda-based notes, chronological narrative, decisions, and action items.
---

# Meeting Transcript

## Overview

Create two generated Markdown files from one raw Zoom transcript: a cleaned transcript and a summary. Preserve the raw file, overwrite generated outputs, and keep filenames unchanged. The user may provide either an explicit path or a natural-language reference such as `/meeting-transcript today's meeting with amanda`.

## Workflow

1. Resolve the raw transcript path.
   - If the user provided an explicit path, use it.
   - If the user provided a natural-language reference, search the default raw meetings folder: `/Users/herbcaudill/Code/herbcaudill/notes/meetings/raw`.
   - Match date words like `today`, `yesterday`, or an explicit date against filenames and frontmatter. Match participant words case-insensitively against filenames and transcript speaker labels. If exactly one good match is found, use it without asking. If none or multiple plausible matches are found, show the candidates and ask which one to use.
2. Run the parser and capture JSON:

   ```bash
   node ~/.claude/skills/meeting-transcript/scripts/parseZoomTranscript.ts "/path/to/raw.md"
   ```

3. Derive output paths. If the raw path contains `/meetings/raw/`, replace it with `/meetings/cleaned/` for the cleaned transcript and `/meetings/` for the summary. Otherwise write sibling files named `{basename}.cleaned.md` and `{basename}.summary.md`.
4. Create parent directories as needed and overwrite existing generated files.
5. Write both files with YAML frontmatter copied from source metadata plus derived fields such as `title`, `participants`, `generated_at`, `source_path`, and `output_type`.

## Cleaned transcript rules

The cleaned transcript is what people said, minus transcription noise. Do not summarize or reinterpret.

- Use normalized speaker names from parser JSON.
- Omit timestamps.
- Keep all utterances, including greetings, logistics, “can you hear me,” and goodbyes.
- Merge fragmented Zoom lines into paragraph-style speaker turns.
- Remove fillers, repeated starts, and verbal stumbles when they do not affect meaning.
- Preserve meaningful hedges like “I think,” “probably,” and uncertainty.
- Correct obvious transcription errors conservatively, especially names and technical terms.
- If crosstalk makes exact ordering hard to read, prioritize readability while preserving meaning.
- Begin the body directly with dialogue after frontmatter.

Example cleanup:

```markdown
Herb: Well, let me explain. What I’m working on right now is setting up an automated way to generate one of your reports in the old system and the new system, then compare them.
```

## Summary rules

The summary is useful meeting notes, not a transcript.

After YAML frontmatter, begin with a human-readable meeting header before the summary content:

```markdown
# Report automation check-in

Monday, June 15, 2026

- Herb Caudill
- Amanda Pinkston
- Brent Keller

Topics

- Report automation and template generation
- AI coding agents

[Full transcript](cleaned/20260615-1300-amanda-herb.md)

---
```

Use the improved title as the H1, derive the human-readable date from meeting metadata or filename, list participants by full name, infer concise topics, and link only to the cleaned transcript. Do not link to the raw transcript.

If the meeting has distinct agenda items, infer them and repeat this structure for each item. If not, use the structure once for the whole meeting.

1. One or two summary paragraphs.
2. `Decisions`, only if there are decisions.
3. `Action items`, only if there are future follow-up items.
4. A chronological narrative from beginning to end, around 25% of the raw transcript length.

Action items should include owners and resolved dates when clear from the meeting date or filename. Example: `Herb: Have something to look at by next Monday (Jun 22).`

Use speaker names where attribution matters, but do not mechanically attribute every sentence. Add an `Uncertainties` section only when a correction or interpretation could affect meaning.

## Frontmatter

Keep filenames unchanged. Improve metadata in frontmatter where useful:

```yaml
title: Report automation check-in with Amanda
participants:
  - Amanda Pinkston
  - Herb Caudill
generated_at: 2026-06-15T18:00:00Z
source_path: /absolute/path/to/raw.md
output_type: cleaned_transcript
```

For summaries, include a relative link to the cleaned transcript in the human-readable header. Do not include a raw transcript link.

## Common mistakes

- Do not drop social or logistical utterances from the cleaned transcript.
- Do not include timestamps in the cleaned transcript.
- Do not ask before overwriting generated outputs.
- Do not invent decisions, action items, dates, or certainty.
- Do not require confirmation of inferred agenda items or title.
- Do not ask for an explicit path when a natural-language reference clearly identifies one raw transcript in the default folder.
