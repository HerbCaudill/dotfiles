#!/bin/bash
#
# Bootstrap script for setting up a dev environment.
# Works on both local machines and sprites.dev.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.sh | bash
#
# For sprites (with GitHub auth):
#   GITHUB_TOKEN=xxx SPRITE_NAME=mysprite curl -fsSL ... | bash
#

set -e

DOTFILES_REPO="https://github.com/HerbCaudill/dotfiles.git"
DOTFILES_DIR="$HOME/code/herbcaudill/dotfiles"
ASDF_VERSION="v0.14.1"

success() { echo -e "\033[1;32m✓\033[0m $1"; }
warn() { echo -e "\033[1;33m!\033[0m $1"; }

echo "Setting up dev environment..."
echo ""

# ---- Clone dotfiles ----
if [[ ! -d "$DOTFILES_DIR" ]]; then
  mkdir -p "$(dirname "$DOTFILES_DIR")"
  git clone -q "$DOTFILES_REPO" "$DOTFILES_DIR"
fi
success "Dotfiles"

# ---- Run install script (symlinks) ----
node "$DOTFILES_DIR/install.mjs" >/dev/null
success "Symlinks"

# ---- Install oh-my-zsh ----
if [[ ! -f "$HOME/.oh-my-zsh/oh-my-zsh.sh" ]]; then
  rm -rf "$HOME/.oh-my-zsh"
  RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" >/dev/null 2>&1
fi
success "oh-my-zsh"

# ---- Install zsh plugins ----
ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

if [[ ! -d "$ZSH_CUSTOM/plugins/zsh-autosuggestions" ]]; then
  git clone -q https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
fi
success "zsh-autosuggestions"

if [[ ! -d "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting" ]]; then
  git clone -q https://github.com/zsh-users/zsh-syntax-highlighting "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
fi
success "zsh-syntax-highlighting"

# ---- Restore custom theme ----
THEME_SRC="$DOTFILES_DIR/home/.oh-my-zsh/custom/themes/herb.zsh-theme"
THEME_DST="$ZSH_CUSTOM/themes/herb.zsh-theme"
if [[ -f "$THEME_SRC" && ! -L "$THEME_DST" ]]; then
  mkdir -p "$(dirname "$THEME_DST")"
  ln -sf "$THEME_SRC" "$THEME_DST"
fi
success "zsh theme"

# ---- Install asdf ----
if [[ ! -d "$HOME/.asdf" ]]; then
  git clone -q https://github.com/asdf-vm/asdf.git "$HOME/.asdf" --branch "$ASDF_VERSION"
fi
success "asdf"

# ---- Install pnpm ----
if ! command -v pnpm &>/dev/null; then
  curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash bash >/dev/null 2>&1 || true
fi
success "pnpm"

# ---- Sprite-specific setup ----
if [[ -n "$SPRITE_NAME" ]]; then
  # GitHub CLI auth
  if [[ -n "$GITHUB_TOKEN" ]]; then
    echo "export GH_TOKEN=$GITHUB_TOKEN" >> "$HOME/.secrets"
    success "GitHub CLI"
  else
    warn "GitHub CLI (set GH_TOKEN manually)"
  fi

  # Create code directory
  mkdir -p "$HOME/code"

  # Save sprite name for prompt
  echo "export SPRITE_NAME=$SPRITE_NAME" >> "$HOME/.secrets"

  # Use nano as default editor
  if [[ ! -f "$HOME/.secrets" ]] || ! grep -q "EDITOR" "$HOME/.secrets"; then
    echo 'export EDITOR=nano' >> "$HOME/.secrets"
    echo 'export VISUAL=nano' >> "$HOME/.secrets"
  fi

fi

echo ""
if [[ -n "$SPRITE_NAME" ]]; then
  echo "👾 $SPRITE_NAME is ready!"
else
  success "Ready!"
fi
