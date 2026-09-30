---
name: morning-briefing
description: Report the morning briefing integration status and begin a Tasks Inbox review when requested.
---

# Morning briefing

The scheduled briefing and Obsidian inbox processing are paused during the Tasks cutover. The briefings repository still reads and writes Google Tasks. Do not run its pipeline directly or bypass the installed launchers; they stop with an explanation until its Tasks provider and existing journal conversion are integrated. See `docs/tasks-agent.md` in dotfiles for the activation status.

For a task review, read the Tasks and task-review skills and use `views: ["inbox"]`. Review directly in the current session. Do not imply that a briefing was generated or that pending Obsidian captures have been imported.

After the Briefings integration is complete, restore the pipeline instruction and have its pinned session invoke task-review once with `views: ["inbox"]`.
