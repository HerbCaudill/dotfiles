#!/bin/bash

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$HOME"

# Find all dotfiles/dotdirs in the repo (excluding .git)
for item in "$DOTFILES_DIR"/.*; do
  name=$(basename "$item")

  # Skip . .. and .git
  [[ "$name" == "." || "$name" == ".." || "$name" == ".git" ]] && continue

  target="$HOME_DIR/$name"

  # Check if target already exists
  if [[ -L "$target" ]]; then
    # It's already a symlink - remove and recreate
    echo "Updating symlink: $name"
    rm "$target"
  elif [[ -e "$target" ]]; then
    # It's a real file/directory - back it up
    echo "Backing up existing $name to $name.backup"
    mv "$target" "$target.backup"
  else
    echo "Creating symlink: $name"
  fi

  ln -s "$item" "$target"
done

echo "Done!"
