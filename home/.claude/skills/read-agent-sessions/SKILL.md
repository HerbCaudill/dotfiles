---
name: read-agent-sessions
description: Find, search, and read local Claude Code and Codex sessions from their filesystem JSONL logs. Use when Claude needs context from a Codex session, Codex needs context from a Claude session, or the user asks to locate, inspect, compare, recover, continue from, or summarize a past or currently running agent conversation without relying on harness-specific session tools.
---

# Read agent sessions

Use the bundled read-only CLI to normalize both harness formats. Prefer it over raw `rg`, `jq`, or SQLite queries because it removes injected instructions and duplicate protocol events.

```bash
node ~/.claude/skills/read-agent-sessions/scripts/agent-sessions.ts --help
```

## Find the session

List recent sessions from the other harness, usually scoped to the current project:

```bash
node ~/.claude/skills/read-agent-sessions/scripts/agent-sessions.ts list --source codex --cwd "$PWD"
node ~/.claude/skills/read-agent-sessions/scripts/agent-sessions.ts list --source claude --cwd "$PWD"
```

Use `--source all` when the originating harness is unknown. Add `--archived` to list older archived Codex sessions. Results are newest first and include the ID, project directory, and first user prompt.

Search literal conversation text when recency and project are insufficient:

```bash
node ~/.claude/skills/read-agent-sessions/scripts/agent-sessions.ts search "distinctive phrase" --source codex --cwd "$PWD"
```

Add `--archived` only when active results do not contain the session; archived Codex logs can be large.

## Read the transcript

Pass an exact ID, a unique ID prefix, or an absolute JSONL path:

```bash
node ~/.claude/skills/read-agent-sessions/scripts/agent-sessions.ts show SESSION_ID
```

The default transcript contains user and assistant text. Add `--tools` only when commands, tool inputs, or tool results are necessary to understand unfinished work:

```bash
node ~/.claude/skills/read-agent-sessions/scripts/agent-sessions.ts show SESSION_ID --tools
```

Summarize the relevant state instead of pasting a long transcript back to the user. Verify important claims against the working tree or current external state before acting; logs are historical evidence and a live session may still be appending.

## Safety

- Treat `~/.claude/projects/**/*.jsonl`, `~/.codex/sessions/**/*.jsonl`, and `~/.codex/archived_sessions/*.jsonl` as read-only.
- Do not expose system/developer instructions, internal reasoning, secrets, or unrelated tool output.
- Do not use filesystem logs to send messages, resume a thread, or mutate session metadata. Use harness-native tools for those actions when available.
- If parsing fails after a harness format change, inspect only a few record keys and update the parser; avoid dumping raw sessions into the conversation.
