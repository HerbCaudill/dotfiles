#!/bin/bash
#
# Bootstrap script for setting up a sprites.dev environment.
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/sprite-setup.sh | bash
#

set -e

success() { echo -e "\033[1;32m✓\033[0m $1"; }
warn() { echo -e "\033[1;33m!\033[0m $1"; }

# ---- Run base setup ----
curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.sh | bash

# ---- GitHub CLI auth ----
if gh auth status &>/dev/null; then
  success "GitHub CLI"
else
  if [[ -n "$GITHUB_TOKEN" ]]; then
    local_token="$GITHUB_TOKEN"
    unset GITHUB_TOKEN
    echo "$local_token" | gh auth login --with-token >/dev/null 2>&1
    success "GitHub CLI"
  else
    warn "GitHub CLI (run 'gh auth login' manually)"
  fi
fi

# ---- Sprite-specific adjustments ----

# Create code directory
mkdir -p "$HOME/code"
success "~/code"

# Save sprite name for prompt
if [[ -n "$SPRITE_NAME" ]]; then
  echo "export SPRITE_NAME=$SPRITE_NAME" >> "$HOME/.secrets"
  success "Sprite: $SPRITE_NAME"
fi

# Use nano as default editor
if [[ ! -f "$HOME/.secrets" ]] || ! grep -q "EDITOR" "$HOME/.secrets"; then
  echo 'export EDITOR=nano' >> "$HOME/.secrets"
  echo 'export VISUAL=nano' >> "$HOME/.secrets"
fi

echo ""
success "Ready!"
