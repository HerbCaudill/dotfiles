---
name: watch-beads
description: Use only when the user explicitly asks to watch or monitor beads for new issues and orchestrate them as they arrive.
---

# Watch beads

Watch the current repository's beads for new ready issues and orchestrate them as they appear.

1. Run `bd ready --json`.
2. If anything is ready, follow the `orchestrate` skill until it finishes.
3. If nothing is ready, wait about a minute and check again. Use the harness's quiet wait mechanism, such as Monitor with an until-loop on `bd ready --json`, rather than repeated foreground polling.
4. Keep watching after each orchestration run finishes. Stop only when the user says to stop.

Polling is silent. Report only when you start work on new issues, finish them, or hit something that needs the user.
