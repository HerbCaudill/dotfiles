---
name: meeting-transcript
description: Use when turning an explicit raw Zoom-style meeting transcript path into a cleaned transcript, meeting summary, agenda-based notes, chronological narrative, decisions, and action items.
---

# Meeting Transcript

## Overview

Create two generated Markdown files from one explicit raw Zoom transcript: a cleaned transcript and a summary. Preserve the raw file, overwrite generated outputs, and keep filenames unchanged.

## Workflow

1. Require an explicit raw transcript path from the user.
2. Run the parser and capture JSON:

   ```bash
   node ~/.claude/skills/meeting-transcript/scripts/parseZoomTranscript.ts "/path/to/raw.md"
   ```

3. Derive output paths. If the raw path contains `/meetings/raw/`, replace it with `/meetings/cleaned/` and `/meetings/summaries/`. Otherwise write sibling files named `{basename}.cleaned.md` and `{basename}.summary.md`.
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

For summaries, include relative links to raw and cleaned files in the body when possible.

## Common mistakes

- Do not drop social or logistical utterances from the cleaned transcript.
- Do not include timestamps in the cleaned transcript.
- Do not ask before overwriting generated outputs.
- Do not invent decisions, action items, dates, or certainty.
- Do not require confirmation of inferred agenda items or title.
