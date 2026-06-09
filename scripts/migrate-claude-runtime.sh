#!/usr/bin/env bash
#
# One-off migration: separate durable Claude config from runtime state.
#
# Background
# ----------
# `~/.claude` is currently a whole-directory symlink into this repo
# (home/.claude). That means Claude/Codex/Pi runtime state — projects,
# sessions, cache, history, etc. — is being written *inside the repo*, and
# any home-manager rebuild that links individual files under `~/.claude`
# loops back on itself ("Too many levels of symbolic links").
#
# Target state (matches nix/home/files.nix):
#   - ~/.claude is a REAL directory holding runtime state
#   - ~/.claude/{skills,agents,CLAUDE.md,settings.json,statusline.js}
#     are symlinks into the repo (created by `pnpm nix:rebuild`)
#   - the repo's home/.claude/ holds ONLY those durable items
#
# This script never deletes data. It moves runtime entries out of the repo
# into a real ~/.claude, and removes only the ~/.claude symlink itself.
#
# Usage:
#   scripts/migrate-claude-runtime.sh            # dry run (prints the plan)
#   scripts/migrate-claude-runtime.sh --apply    # do it
#
# Run it from a PLAIN terminal, NOT from inside a Claude Code / pi session
# (it relocates the very directory an active session logs into). Use --force
# only if you understand that risk.
#
set -euo pipefail

REPO="/Users/herbcaudill/Code/HerbCaudill/dotfiles"
REPO_CLAUDE="$REPO/home/.claude"
HOME_CLAUDE="$HOME/.claude"

# Durable items that stay in the repo (kept in sync with .gitignore allowlist).
DURABLE=(CLAUDE.md agents settings.json skills statusline.js)

APPLY=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --force) FORCE=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

say()  { printf '%s\n' "$*"; }
step() { printf '  • %s\n' "$*"; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

is_durable() {
  local name="$1"
  for d in "${DURABLE[@]}"; do [ "$name" = "$d" ] && return 0; done
  return 1
}

# --- Guards -----------------------------------------------------------------

[ -d "$REPO_CLAUDE" ] || die "repo path not found: $REPO_CLAUDE"

# The earlier loop-fix must already be applied: skills must be a real dir,
# not a leftover symlink into the nix store.
if [ -L "$REPO_CLAUDE/skills" ]; then
  die "$REPO_CLAUDE/skills is still a symlink — restore durable files first."
fi
for d in "${DURABLE[@]}"; do
  [ -e "$REPO_CLAUDE/$d" ] || die "expected durable item missing: $REPO_CLAUDE/$d"
done

if [ "${CLAUDECODE:-}" = "1" ] && [ "$FORCE" -ne 1 ]; then
  die "running inside a Claude Code session (CLAUDECODE=1). Open a plain terminal and re-run, or pass --force."
fi

# --- Determine state --------------------------------------------------------

if [ -L "$HOME_CLAUDE" ]; then
  target="$(realpath "$HOME_CLAUDE")"
  if [ "$target" != "$REPO_CLAUDE" ]; then
    die "~/.claude symlink points to '$target', not the repo. Aborting — investigate manually."
  fi
  MODE="symlink"   # ~/.claude -> repo; runtime data physically lives in the repo
elif [ -d "$HOME_CLAUDE" ]; then
  if [ "$(realpath "$HOME_CLAUDE")" = "$REPO_CLAUDE" ]; then
    die "~/.claude resolves to the repo but is not a plain symlink. Investigate manually."
  fi
  MODE="realdir"   # already a real, separate directory — only need to drain leftovers
else
  die "~/.claude is neither a symlink nor a directory ($HOME_CLAUDE)."
fi

# --- Build the move list ----------------------------------------------------
# Anything in the repo's home/.claude that is NOT durable is runtime state and
# should move to the real ~/.claude.

mapfile -t RUNTIME < <(
  cd "$REPO_CLAUDE" && for entry in $(ls -1A); do
    is_durable "$entry" || printf '%s\n' "$entry"
  done
)

say "Plan ($([ "$APPLY" -eq 1 ] && echo APPLY || echo 'dry run')):"
say "  ~/.claude state : $MODE"
say "  repo durable    : ${DURABLE[*]}"
if [ "${#RUNTIME[@]}" -eq 0 ]; then
  say "  runtime to move : (none — nothing left in the repo to relocate)"
else
  say "  runtime to move : ${#RUNTIME[@]} item(s) from repo -> ~/.claude"
  for r in "${RUNTIME[@]}"; do step "$r"; done
fi

if [ "$APPLY" -ne 1 ]; then
  say ""
  say "Dry run only. Re-run with --apply to perform the migration."
  exit 0
fi

# --- Apply ------------------------------------------------------------------

# 1. Make ~/.claude a real, empty directory (preserving its current contents,
#    which physically live in the repo and are moved in step 2).
if [ "$MODE" = "symlink" ]; then
  step "removing ~/.claude symlink (target data stays in the repo, untouched)"
  rm "$HOME_CLAUDE"
  mkdir -p "$HOME_CLAUDE"
fi

# 2. Move every runtime entry out of the repo into the real ~/.claude.
for entry in "${RUNTIME[@]}"; do
  src="$REPO_CLAUDE/$entry"
  dst="$HOME_CLAUDE/$entry"
  if [ -e "$dst" ]; then
    die "destination already exists: $dst (refusing to overwrite). Resolve manually."
  fi
  step "moving $entry"
  mv "$src" "$dst"
done

say ""
say "Done. ~/.claude is now a real directory with runtime state; the repo holds"
say "only durable config. Next, apply the home-manager config so the durable"
say "files get linked back into ~/.claude:"
say ""
say "    pnpm nix:rebuild"
say ""
say "If the rebuild complains about an existing ~/.claude, re-run it with a"
say "backup extension, e.g.:  darwin-rebuild switch ... -b backup"
