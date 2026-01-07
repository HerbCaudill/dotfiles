#!/bin/bash

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$HOME"

# Create symlink helper
create_symlink() {
  local source="$1"
  local target="$2"
  local name=$(basename "$target")

  # Create parent directory if needed
  mkdir -p "$(dirname "$target")"

  if [[ -L "$target" ]]; then
    echo "Updating symlink: $target"
    rm "$target"
  elif [[ -e "$target" ]]; then
    echo "Backing up existing $target to $target.backup"
    mv "$target" "$target.backup"
  else
    echo "Creating symlink: $target"
  fi

  ln -s "$source" "$target"
}

# Top-level dotfiles (excluding special directories we handle separately)
for item in "$DOTFILES_DIR"/.*; do
  name=$(basename "$item")

  # Skip . .. .git and directories we handle specially
  [[ "$name" == "." || "$name" == ".." || "$name" == ".git" ]] && continue
  [[ "$name" == ".config" || "$name" == ".oh-my-zsh" ]] && continue

  # Skip gitignored items
  git -C "$DOTFILES_DIR" check-ignore -q "$item" 2>/dev/null && continue

  create_symlink "$item" "$HOME_DIR/$name"
done

# Nested configs - symlink specific files/directories within existing directories

# Karabiner
if [[ -f "$DOTFILES_DIR/.config/karabiner/karabiner.json" ]]; then
  create_symlink "$DOTFILES_DIR/.config/karabiner/karabiner.json" "$HOME_DIR/.config/karabiner/karabiner.json"
fi

# Oh My Zsh custom theme
if [[ -f "$DOTFILES_DIR/.oh-my-zsh/custom/themes/herb.zsh-theme" ]]; then
  create_symlink "$DOTFILES_DIR/.oh-my-zsh/custom/themes/herb.zsh-theme" "$HOME_DIR/.oh-my-zsh/custom/themes/herb.zsh-theme"
fi

echo "Done!"
