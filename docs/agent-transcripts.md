# Shared agent transcripts

The private [HerbCaudill/agent-transcripts](https://github.com/HerbCaudill/agent-transcripts) repository contains conversation files from the MacBook and mini. Both machines keep a clone at `~/Code/HerbCaudill/agent-transcripts` (`C:\Code\HerbCaudill\agent-transcripts` on mini). No reciprocal SSH connection is required. Each machine uploads its own sessions and downloads the shared branch every 15 minutes.

## Contents

Each writer owns `machines/<name>/`. Claude Code, Codex active and archived sessions, Pi sessions, and the Claude/Codex history JSONL files are copied without changing the original stores. The shared copy retains readable conversation and tool text. Embedded images, audio, encrypted reasoning payloads, and binary blobs are replaced with markers. Claude and Codex copies omit internal reasoning, runtime instructions, and duplicate protocol events while retaining native session IDs, working directories, timestamps, conversation messages, and tool traffic. The full raw files remain on their original machines. SQLite files are excluded. Missing source files remain in the archive, so removing a local session does not remove its archived copy.

Text transcripts are gzip-compressed. Compressed files larger than 32 MiB are split into numbered parts. Each machine's `manifest.json` records the source modification date and size, text format version, ordered fragment paths, a small session summary, and the snapshot time. The read-agent-sessions skill reconstructs these files and uses the original dates for listing and filtering. It currently reads Claude Code and Codex; Pi is preserved for future reader support.

The original local archive was retained during the October 2026 migration at `~/.local/share/agent-transcripts-legacy-20261016`. Its older JSONL files were imported into the new archive. Its Git history and SQLite databases were not uploaded.

## Read sessions

Use the read-agent-sessions skill. `--machine all` searches all archived machines; `--machine macbook` or `--machine mini` selects one. The default, `--machine local`, reads the current computer's live harness stores. The `machines` command shows locally available snapshot times without network access. `--project ORG/REPO` matches checkouts beneath `Code` on either operating system. Worktrees need their recorded `--cwd` or an unscoped search.

Offline reads use the most recently downloaded snapshots. Work newer than a remote machine's last upload becomes available only after that machine syncs.

## Enroll another machine

Clone the private repository, then run `git config agentTranscripts.machine <name>` in that clone. Use a stable name containing letters, numbers, underscores, or hyphens. Each name must have one writer. Sign in to GitHub and run `gh auth setup-git`. Windows S4U tasks need the existing mini authentication setup described in the mini skill because they cannot access Credential Manager.

On macOS, run `agent-transcripts-sync`. The existing `com.herbcaudill.agent-transcripts-sync` launchd agent runs the same wrapper every 900 seconds. Its output goes to `/tmp/agent-transcripts-sync.log`.

On Windows, run `scripts/windows/register-agent-transcripts-task.ps1` from an elevated shell in the dotfiles clone. The task runs under Herb's account with S4U, uses PowerShell 7 and the newest supported Node installed by mise, ignores overlapping launches, and starts missed runs when the machine becomes available. It does not require mise to have a global default. Its log is `%LOCALAPPDATA%\agent-transcripts-sync.log`. Run `scripts/windows/sync-agent-transcripts.ps1` for a manual sync.

`AGENT_TRANSCRIPTS_REPO_PATH` overrides the writer's clone path. `AGENT_SESSIONS_ARCHIVE_ROOT` overrides the reader's clone path.

## Failure and recovery

A sync compresses changed source files, commits only its own machine directory, fetches and rebases onto the shared main branch, then pushes. A rejected push caused by another writer is retried up to three times. Network failures leave the local snapshot commit intact for the next run. Unrelated staged changes cause the sync to stop rather than commit them. Keep the clone on main and leave generated files alone.

The generic `gh-sync` job skips this repository so it cannot race the transcript writer's Git operations.

The writer's own `.git/agent-transcripts-sync.lock` records a PID. A later run recovers it only after that process has exited. Git's `index.lock` is never removed automatically. If Git reports a lock, stop the archive sync job, verify no Git process owns the lock, and remove the stale Git lock before restarting the job. Resolve a rebase conflict explicitly before the next run; do not reset the archive or discard either machine's commits.

To retrieve snapshots without creating a local snapshot, use `git pull --ff-only` in a clean archive clone.
