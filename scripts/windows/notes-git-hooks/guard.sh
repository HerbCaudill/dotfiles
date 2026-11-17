#!/bin/sh
# Refuses commits, merges and pushes in the mini's notes vault checkout.
# On the mini, Obsidian Sync is the vault's only sync method: it carries edits to the Mac, whose
# obsidian-sync job commits them. A second committer here diverges from GitHub, and on October 26,
# 2026 the Obsidian Git plugin left this checkout stuck mid-merge for three weeks without anyone
# noticing. Each refusal is logged so Leo's heartbeat can report it.
log="$HOME/.local/state/notes-vault/git-blocked.log"
mkdir -p "$(dirname "$log")"
echo "$(date '+%Y-%m-%dT%H:%M:%S%z') refused $1 in $(pwd)" >>"$log"
cat >&2 <<'MESSAGE'
Refusing to commit, merge or push in the mini's notes vault.
On the mini, Obsidian Sync carries vault changes to the Mac, and the Mac commits them.
Leave your edits in the working tree. See the vault's AGENTS.md.
MESSAGE
exit 1
