---
name: morning-briefing
description: Generate Herb's morning briefing.
---

Run the repository-owned morning briefing pipeline:

```bash
cd ~/Code/HerbCaudill/briefings && pnpm morning-briefing
```

The command owns the complete workflow. It gathers sources through parallel agents, persists private intermediate artifacts, writes and verifies today's `## Daily briefing` section in Obsidian, waits for Obsidian Sync, creates the clean pinned Codex presentation task, and prints the same briefing to standard output.

Do not gather sources separately, edit the daily note yourself, or take any actions from the briefing. When the command succeeds, respond with only the briefing it printed, exactly as printed. When it fails, report the command error plainly and point to the newest run manifest under `~/.local/state/morning-briefing/YYYY-MM-DD/`.
