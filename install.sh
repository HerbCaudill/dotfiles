#!/bin/bash

# Symlink dotfiles from this repo to home directory
# Symlinks individual files, except for .claude/skills which is linked as a directory

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$DOTFILES_DIR/home"

echo "Installing dotfiles from $DOTFILES_DIR"

# Handle .claude/skills as a directory symlink
skills_src="$HOME_DIR/.claude/skills"
skills_target="$HOME/.claude/skills"
if [ -d "$skills_src" ]; then
  mkdir -p "$HOME/.claude"
  if [ -L "$skills_target" ] || [ -d "$skills_target" ]; then
    echo "Removing existing: $skills_target"
    rm -rf "$skills_target"
  fi
  echo "Linking directory: .claude/skills"
  ln -s "$skills_src" "$skills_target"
fi

# Find all files (not directories) in home/, excluding .claude/skills
find "$HOME_DIR" -type f | grep -v '\.claude/skills' | while read -r file; do
  # Get the relative path from home/
  rel_path="${file#$HOME_DIR/}"
  target="$HOME/$rel_path"

  # Create parent directory if needed
  mkdir -p "$(dirname "$target")"

  # Remove existing file or symlink
  if [ -L "$target" ] || [ -f "$target" ]; then
    echo "Removing existing: $target"
    rm "$target"
  fi

  # Create symlink
  echo "Linking: $rel_path"
  ln -s "$file" "$target"
done

echo "Done!"
