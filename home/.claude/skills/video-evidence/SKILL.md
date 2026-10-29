---
name: video-evidence
description: Use to record or upload a UI video and embed it in a GitHub pull request or issue with gh --attach.
---

# Video evidence

Produce a short, reviewable video and publish it with GitHub CLI's supported `--attach` flag. Keep recording, upload, and posting as separate authorization decisions. The CLI uploads and posts in one command, so complete review and confirm authorization before running it.

## Choose the starting point

- If the user supplies a local video, preserve it and begin with review.
- If the user asks to record behavior, inspect the repository's instructions and scripts and use its existing browser harness and video mode. In VibeResults, run `pnpm test:video <spec> -g "<scenario>"`; recordings land under `test-results/video/results/`.
- If no repository recorder exists, use Playwright `recordVideo` with an explicit viewport. Drive a focused scenario with assertions and deterministic data, close the browser context before resolving the video path, and use brief post-assertion pauses only when they make the result readable.
- Do not stop, reuse, or alter an unrelated running service merely to obtain a recording. Follow the repository's server ownership and fixture rules.

## Review before upload

Confirm that the file exists, has a supported `.mp4`, `.mov`, or `.webm` extension, is within GitHub's video size limit (10 MB on Free plans, 100 MB on paid plans), and decodes in a browser. Watch the relevant sequence, not merely the final frame. Reject a blank, stale, truncated, or misleading recording and regenerate it.

Check for credentials, personal data, unrelated tabs, notifications, and real customer data. GitHub attachments in public repositories are publicly accessible; private-repository attachments are limited to people who can access the repository.

## Authorization boundary

A request to attach a video to a named GitHub pull request or issue authorizes the upload and that specific post. A request to record, review, or return a local video does not authorize an upload. Creating a new issue or pull request requires an explicit request to create it.

## Attach and post

Require GitHub CLI 2.99 or later, an authenticated `gh` session, and push access to the target repository. Check `gh --version` and the relevant command's `--help` if needed. Never print, log, or pass the token as a command-line argument. GitHub Enterprise Server is not supported by this attachment feature.

When the user authorizes posting, prefer a new comment so existing authored content is not overwritten. Write a concise scenario description to a local Markdown body file. Follow the repository's attribution rules; under Herb's account, begin with `> Codex posting on behalf of Herb Caudill` (use your own agent name). Then run the appropriate command:

```text
gh pr comment <number> --repo <owner/repository> --body-file <body.md> --attach <video-path>
gh issue comment <number> --repo <owner/repository> --body-file <body.md> --attach <video-path>
```

Quote paths containing spaces. Files not referenced in the body are appended automatically. Repeat `--attach` for multiple files. Do not add `#alt text` to a video; videos have no alt text.

MP4 and WebM attachments render as GitHub's native video player. For a specific position in the body, put `![](<video-path>)` alone in its own paragraph and attach that same path. The CLI replaces the entire reference with the uploaded URL. A reference within a sentence renders as a link instead. Leave the reference out to let the CLI append the player after the description.

Update a pull request or issue body only when the user asks for that placement; `gh pr edit` and `gh issue edit` also support `--attach`. Use `gh pr create` or `gh issue create` with `--attach` only when creation is explicitly authorized. Do not commit generated recordings to the repository unless explicitly requested.

If uploading fails, report the error without exposing credentials. Do not use a custom uploader or undocumented endpoint, and do not build retries around authentication or persistent client errors. Do not post to a real issue or pull request merely to test rendering without the user's approval.

## Return

Read back the posted body to verify the attachment and obtain its URL. Report the scenario recorded, local path, duration and resolution when available, GitHub attachment URL, and the PR or issue URL if posted. State whether the repository is public or private when that affects who can view the result.

## References

- [GitHub CLI attachment documentation](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli) explains standalone video references (player) versus references within sentences (link).
- `gh pr comment --help` and `gh issue comment --help` confirm that video renders as a player and has no alt text.
- [GitHub CLI media announcement](https://github.blog/changelog/2026-09-01-github-cli-media-in-issues-pull-requests-and-comments/) lists supported formats, commands, version requirements, and size limits.
