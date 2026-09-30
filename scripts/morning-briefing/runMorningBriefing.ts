#!/usr/bin/env -S node --experimental-strip-types

console.error(
  "[runMorningBriefing] Paused: Briefings still uses Google Tasks. Integrate its Tasks provider and convert existing journals before resuming. See dotfiles/docs/tasks-agent.md.",
)
process.exitCode = 1
