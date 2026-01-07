#!/bin/bash

# Symlink dotfiles from this repo to home directory
# Paths listed in symlink-dirs.conf are linked as directories
# All other files are linked individually

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$DOTFILES_DIR/home"
CONFIG_FILE="$DOTFILES_DIR/symlink-dirs.conf"

echo "Installing dotfiles from $DOTFILES_DIR"

# Build grep pattern from config file (skip comments and empty lines)
dir_patterns=""
if [ -f "$CONFIG_FILE" ]; then
  while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

    dir_src="$HOME_DIR/$line"
    dir_target="$HOME/$line"

    if [ -d "$dir_src" ]; then
      mkdir -p "$(dirname "$dir_target")"
      if [ -L "$dir_target" ] || [ -d "$dir_target" ]; then
        echo "Removing existing: $dir_target"
        rm -rf "$dir_target"
      fi
      echo "Linking directory: $line"
      ln -s "$dir_src" "$dir_target"

      # Add to exclusion pattern
      [ -n "$dir_patterns" ] && dir_patterns="$dir_patterns|"
      dir_patterns="$dir_patterns$line"
    fi
  done < "$CONFIG_FILE"
fi

# Find all files, excluding directory-linked paths
find "$HOME_DIR" -type f | while read -r file; do
  rel_path="${file#$HOME_DIR/}"

  # Skip if file is under a directory-linked path
  if [ -n "$dir_patterns" ] && echo "$rel_path" | grep -qE "^($dir_patterns)/"; then
    continue
  fi

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
