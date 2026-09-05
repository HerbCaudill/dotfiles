---
name: morning-briefing
description: Generate Herb's morning briefing and begin an Inbox then Today task review in the same pinned session.
---

Run the repository-owned morning briefing pipeline:

```bash
cd ~/Code/HerbCaudill/briefings && pnpm briefing:morning
```

The command owns the complete workflow. It processes new Obsidian inbox captures, starts relevant research independently, gathers sources through parallel agents, persists private intermediate artifacts, writes and verifies today's `## Daily briefing` section in Obsidian, waits for Obsidian Sync, and creates a clean pinned Codex session. That session first presents the exact saved briefing, then invokes task-review once with `listNames: ["Inbox", "Today"]` and asks the first useful question. The command prints the saved briefing to standard output.

Do not gather sources separately, edit the daily note yourself, take actions from the briefing, or start a second task review. When the command succeeds, respond with only the briefing it printed, exactly as printed; the interview continues in its pinned session. When it fails, report the command error plainly and point to the newest run manifest under `~/.local/state/morning-briefing/YYYY-MM-DD/`. If only the review kickoff fails, the verified briefing remains pinned for recovery.
