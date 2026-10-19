---
name: video-feedback
description: Use when Herb gives you a screen recording or a Scrawl capture (a `.scrawl` bundle, or a pasted summary starting `[scrawl …]`) of himself commenting on an app and wants it turned into tasks, issues, or a list of changes.
---

# Video feedback

Herb records his screen while he talks through an app, often with the new app and a reference (such as a legacy app) side by side. Turn the recording into a timestamped transcript, look at frames where the narration points at something, and file one task per distinct piece of feedback.

For a Scrawl capture, follow "Scrawl captures" below instead of steps 1–3, then continue from step 4.

## Scrawl captures

[Scrawl](https://github.com/kitlangton/scrawl) records the screen, voice, clicks and Herb's drawings, and packs them into a `.scrawl` bundle directory under `~/Library/Application Support/scrawl/captures/`. Herb usually pastes its `summary.md`, which starts with `[scrawl <length> · <apps> · <bundle path>]` and lists numbered moments with their times and narration. The CLI is `/Applications/Scrawl.app/Contents/MacOS/scrawl`; it is not on the PATH.

The bundle already has what steps 1–3 produce:

- `summary.md`: one line per moment, `#N (M:SS) [clicked] “narration”`. A moment is a scene change, a click, or a drawing.
- `frames/frame-NN.png`: the frame for moment N, cropped to the apps in use, with Herb's drawings and click markers burned in. `frames-full/` has the uncropped frames.
- `scrawl.json`: `keyframes` (time, reason, file, `said`), `marks` (each drawing's shape and normalized box), `events` (clicks and keys), and `transcript` (`source`, `words` with times in ms).
- `audio.wav` and `recording.mp4`, on the same clock as `scrawl.json`.

Steps:

1. **Pin the bundle** so the links in the tasks keep working. Scrawl trashes media after 7 days and whole bundles after 30: `scrawl pin "$BUNDLE"`.
2. **Retranscribe** if `transcript.source` in `scrawl.json` isn't `hex:…`. Apple's speech recognition drops and mishears words; Whisper does better, and keeping Scrawl's own moments preserves the frames it cut on spoken cues. Run Whisper with word timestamps, then merge its words into Scrawl's moments:

   ```bash
   mkdir -p /tmp/vfb && mlx_whisper "$BUNDLE/audio.wav" --model mlx-community/whisper-large-v3-turbo --language en \
     --condition-on-previous-text False --word-timestamps True --output-format json --output-dir /tmp/vfb
   node ~/.claude/skills/video-feedback/scripts/mergeScrawlTranscript.mts "$BUNDLE" /tmp/vfb/audio.json
   ```

   The script prints each moment with its frame and Whisper's text, plus Apple's text where the two differ. A word or two can land in the neighboring moment. Where the versions disagree in a way that changes the meaning, look at the frame before choosing, and say in the task which reading you chose.
3. **Look at the frames** for moments with feedback. A drawing marks exactly what Herb means. For more context, use `frames-full/`; for what happened between moments, `scrawl zoom "$BUNDLE" --at 1:07` (a time or a phrase) makes a dense contact sheet around it.

In tasks, cite the bundle path and `summary.md`, and quote the merged wording.

## 1. Inspect the recording

```bash
ffprobe -hide_banner "$VIDEO" 2>&1 | grep -E 'Duration|Stream'
```

Work in a scratch directory such as `/tmp/vfb`, not beside the video.

## 2. Extract audio and frames

```bash
mkdir -p /tmp/vfb/frames && cd /tmp/vfb
ffmpeg -loglevel error -y -i "$VIDEO" -vn -ac 1 -ar 16000 audio.wav
ffmpeg -loglevel error -y -i "$VIDEO" -vf "fps=1/10,scale=iw/2:-1" -q:v 4 frames/f_%04d.jpg
```

Frame `f_N.jpg` is at `(N-1) * 10` seconds. Half-width frames keep Retina text readable without wasting tokens. For a moment that needs more precision, grab a single frame: `ffmpeg -ss 00:05:12 -i "$VIDEO" -frames:v 1 -q:v 3 at-0512.jpg`.

## 3. Transcribe

```bash
mlx_whisper audio.wav --model mlx-community/whisper-large-v3-turbo --language en \
  --condition-on-previous-text False --output-format srt --output-dir /tmp/vfb
```

Always pass `--condition-on-previous-text False`. Without it, Whisper falls into a loop during long silences (Herb often pauses while clicking around) and emits "Okay." for the rest of the file, losing everything after that point. If the transcript still ends in a run of identical short lines, find where real speech resumes with `ffmpeg -i audio.wav -af silencedetect=n=-40dB:d=3 -f null -`, cut from there with `-ss`, re-transcribe that piece, and offset its timestamps.

Flatten the SRT into one `HH:MM:SS text` line per cue, drop empty and repeated lines, and save it beside the video as `<name>-transcript.txt` so tasks can cite it.

## 4. Match narration to the screen

Read the transcript first and note the moments where Herb says "this", "here", "these", or names a UI element. Look at the frames for those moments (usually 10–20 frames, not all of them). Use them to work out:

- which side of the screen and which control he means;
- what the reference app does differently, when he says "like the old site";
- when he is just rearranging things to make a comparison, which is not feedback.

Spoken feedback is loose. Keep his intent and his own reasoning ("you need to see the tile while you edit it"), but say concretely what to change. When he is unsure ("I'm not sure where this comes from"), record the question in the task rather than inventing an answer. Note what he explicitly says is fine, so nobody changes it.

## 5. File tasks

Use the repository's tracker – `bd` where there is a `.beads` directory (see the `manage-tasks` skill). Check for existing open issues on the same subject first.

- Create one epic for the recording, with the video and transcript paths in its description.
- Create one child per distinct change. Group remarks about the same control or panel; split remarks that different people could do independently.
- Start each description with what's wrong and what to do, then the video timestamps it came from (for example, "(6:05)"), then the source line.
- Use `bug` for broken behavior and `task` or `feature` for design changes. Add dependencies where one task reshapes the UI another task polishes.
- Follow the repository's naming and terminology rules in titles.

## 6. Report

Summarize the tasks grouped by area, with IDs. Mention anything you deliberately left out and any part of the audio you couldn't make out. Delete the scratch files in `/tmp/vfb` when done; leave Scrawl bundles in place.
