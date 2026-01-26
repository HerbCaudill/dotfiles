#!/bin/bash
#
# Bootstrap script for setting up a sprites.dev environment.
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/sprite-setup.sh | bash
#
# Or interactively (will prompt for token):
#   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/sprite-setup.sh | bash
#

set -e

info() { echo -e "\033[1;34m→\033[0m $1"; }
success() { echo -e "\033[1;32m✓\033[0m $1"; }
warn() { echo -e "\033[1;33m!\033[0m $1"; }

# ---- Run base setup ----
info "Running base dotfiles setup..."
curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.sh | bash

# ---- GitHub CLI auth ----
if gh auth status &>/dev/null; then
  success "GitHub CLI already authenticated"
else
  if [[ -n "$GITHUB_TOKEN" ]]; then
    info "Authenticating GitHub CLI with token..."
    echo "$GITHUB_TOKEN" | gh auth login --with-token
    success "GitHub CLI authenticated"
  else
    warn "GITHUB_TOKEN not set - run 'gh auth login' manually or re-run with:"
    warn "  GITHUB_TOKEN=ghp_xxx curl -fsSL ... | bash"
  fi
fi

# ---- Sprite-specific adjustments ----

# Use nano as default editor (vscode not available on remote sprite)
if [[ ! -f "$HOME/.secrets" ]] || ! grep -q "EDITOR" "$HOME/.secrets"; then
  info "Setting nano as default editor..."
  echo 'export EDITOR=nano' >> "$HOME/.secrets"
  echo 'export VISUAL=nano' >> "$HOME/.secrets"
  success "Editor set to nano"
fi

echo ""
success "Sprite setup complete!"

# Reload shell with new config
exec zsh
