---
name: morning-briefing
description: Generate Herb's morning briefing and begin a Tasks Inbox review in a pinned T3 Code thread.
---

Run the repository-owned morning briefing pipeline:

```bash
cd ~/Code/HerbCaudill/briefings && pnpm briefing:morning
```

The command owns the complete workflow. It processes new Obsidian inbox captures, starts relevant research independently, gathers sources through parallel agents, persists private intermediate artifacts, writes and verifies today's `## Daily briefing` section in Obsidian, waits for Obsidian Sync, and triggers a T3 Code webhook task. That task starts a fresh pinned thread, which first presents the exact saved briefing, then invokes task-review once with `views: ["inbox"]` and asks the first useful question. The command prints the saved briefing to standard output.

Do not gather sources separately, edit the daily note yourself, take actions from the briefing, or start a second task review. When the command succeeds, respond with only the briefing it printed, exactly as printed; the interview continues in its pinned session. When it fails, report the command error plainly and point to the newest run manifest under `~/.local/state/morning-briefing/YYYY-MM-DD/`. If only the T3 webhook fails, the briefing is still saved in the daily note.
