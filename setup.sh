#!/bin/bash
#
# Bootstrap script for setting up a new dev environment.
# Can be run with: curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.sh | bash
#

set -e

DOTFILES_REPO="https://github.com/HerbCaudill/dotfiles.git"
DOTFILES_DIR="$HOME/code/herbcaudill/dotfiles"
ASDF_VERSION="v0.14.1"

success() { echo -e "\033[1;32m✓\033[0m $1"; }

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
  npm install -g pnpm >/dev/null 2>&1
fi
success "pnpm"
