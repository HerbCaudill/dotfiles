#!/bin/bash
#
# Bootstrap script for setting up a new dev environment.
# Can be run with: curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.sh | bash
#

set -e

DOTFILES_REPO="https://github.com/HerbCaudill/dotfiles.git"
DOTFILES_DIR="$HOME/code/herbcaudill/dotfiles"
ASDF_VERSION="v0.14.1"

info() { echo -e "\033[1;34m→\033[0m $1"; }
success() { echo -e "\033[1;32m✓\033[0m $1"; }
warn() { echo -e "\033[1;33m!\033[0m $1"; }

# ---- Clone dotfiles ----
if [[ -d "$DOTFILES_DIR" ]]; then
  success "Dotfiles already cloned"
else
  info "Cloning dotfiles..."
  mkdir -p "$(dirname "$DOTFILES_DIR")"
  git clone "$DOTFILES_REPO" "$DOTFILES_DIR"
  success "Dotfiles cloned"
fi

# ---- Run install script (symlinks) ----
info "Running install script..."
node "$DOTFILES_DIR/install.mjs"
success "Symlinks created"

# ---- Install oh-my-zsh ----
if [[ -f "$HOME/.oh-my-zsh/oh-my-zsh.sh" ]]; then
  success "oh-my-zsh already installed"
else
  info "Installing oh-my-zsh..."
  # Remove partial installation if exists
  rm -rf "$HOME/.oh-my-zsh"
  RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
  success "oh-my-zsh installed"
fi

# ---- Install zsh plugins ----
ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

if [[ -d "$ZSH_CUSTOM/plugins/zsh-autosuggestions" ]]; then
  success "zsh-autosuggestions already installed"
else
  info "Installing zsh-autosuggestions..."
  git clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
  success "zsh-autosuggestions installed"
fi

if [[ -d "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting" ]]; then
  success "zsh-syntax-highlighting already installed"
else
  info "Installing zsh-syntax-highlighting..."
  git clone https://github.com/zsh-users/zsh-syntax-highlighting "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
  success "zsh-syntax-highlighting installed"
fi

# ---- Restore custom theme (install.mjs symlinks it, but oh-my-zsh may overwrite) ----
THEME_SRC="$DOTFILES_DIR/home/.oh-my-zsh/custom/themes/herb.zsh-theme"
THEME_DST="$ZSH_CUSTOM/themes/herb.zsh-theme"
if [[ -f "$THEME_SRC" && ! -L "$THEME_DST" ]]; then
  info "Linking custom theme..."
  mkdir -p "$(dirname "$THEME_DST")"
  ln -sf "$THEME_SRC" "$THEME_DST"
  success "Custom theme linked"
fi

# ---- Install asdf ----
if [[ -d "$HOME/.asdf" ]]; then
  success "asdf already installed"
else
  info "Installing asdf..."
  git clone https://github.com/asdf-vm/asdf.git "$HOME/.asdf" --branch "$ASDF_VERSION"
  success "asdf installed"
fi

# ---- Install pnpm ----
if command -v pnpm &>/dev/null; then
  success "pnpm already installed ($(pnpm --version))"
else
  info "Installing pnpm..."
  npm install -g pnpm
  success "pnpm installed"
fi

echo ""
success "Setup complete! Run 'exec zsh' to reload your shell."
