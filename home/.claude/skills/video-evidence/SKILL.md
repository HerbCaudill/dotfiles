---
name: video-evidence
description: Use to record or upload a UI video and embed it in a GitHub pull request or issue.
---

# Video evidence

Produce a short, reviewable video and publish it through GitHub's repository-scoped user attachment store. Keep recording, upload, and posting as separate decisions so the user's authorization is never broadened.

## Choose the starting point

- If the user supplies a local video, preserve it and begin with review.
- If the user asks to record behavior, inspect the repository's instructions and scripts and use its existing browser harness and video mode. In VibeResults, run `pnpm test:video <spec> -g "<scenario>"`; recordings land under `test-results/video/results/`.
- If no repository recorder exists, use Playwright `recordVideo` with an explicit viewport. Drive a focused scenario with assertions and deterministic data, close the browser context before resolving the video path, and use brief post-assertion pauses only when they make the result readable.
- Do not stop, reuse, or alter an unrelated running service merely to obtain a recording. Follow the repository's server ownership and fixture rules.

## Review before upload

Confirm that the file exists, has a supported `.mp4`, `.mov`, or `.webm` extension, is no larger than 100 MB, and decodes in a browser. Watch the relevant sequence, not merely the final frame. Reject a blank, stale, truncated, or misleading recording and regenerate it.

Check for credentials, personal data, unrelated tabs, notifications, and real customer data. GitHub attachments in public repositories are publicly accessible; private-repository attachments are limited to people who can access the repository.

## Authorization boundary

A request to attach a video to a named GitHub pull request or issue authorizes the upload and that specific post. A request to record, review, or return a local video does not authorize an upload. Creating a new issue or pull request requires an explicit request to create it.

## Upload

Require an authenticated `gh` session. Never print, log, or pass the token as a command-line argument. Run:

```text
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON <skill-dir>/scripts/upload-github-video.ts <video-path> [owner/repository]
```

The script obtains the token from `gh auth token`, resolves the numeric repository ID, uploads the bytes to GitHub, and prints only the stable `github.com/user-attachments/assets/...` URL. The repository argument is optional inside the target checkout.

The attachment endpoint is undocumented. If it fails, report the response without exposing credentials and fall back to GitHub's supported manual drag-and-drop upload. Do not build retries around authentication or persistent client errors.

## Embed or post

Put the returned video URL on its own line; image Markdown prevents GitHub's native player from rendering. Add a concise sentence describing the scenario above it.

When the user authorizes posting, prefer a new comment so existing authored content is not overwritten:

```text
gh pr comment <number> --repo <owner/repository> --body $'<description>\n\n<video-url>'
gh issue comment <number> --repo <owner/repository> --body $'<description>\n\n<video-url>'
```

Update a pull request or issue body only when the user asks for that placement. Do not commit generated recordings to the repository unless explicitly requested.

## Return

Report the scenario recorded, local path, duration and resolution when available, GitHub attachment URL, and the PR or issue URL if posted. State whether the repository is public or private when that affects who can view the result.
