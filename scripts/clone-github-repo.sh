#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Clone GitHub Repo
# @raycast.mode fullOutput
# @raycast.packageName Developer Utils

# Optional parameters:
# @raycast.icon 🐙
# @raycast.description Clone a GitHub repo, install dependencies, and open in VS Code

# Get URL from Chrome's active tab, fall back to clipboard
get_github_url() {
  # Try Chrome first
  url=$(osascript -e 'tell application "Google Chrome" to get URL of active tab of front window' 2>/dev/null)

  # Fall back to clipboard
  if [[ -z "$url" || "$url" != *"github.com"* ]]; then
    url=$(pbpaste)
  fi

  echo "$url"
}

# Parse org and repo from GitHub URL
parse_github_url() {
  local url="$1"
  # Strip query string and hash
  url="${url%%\?*}"
  url="${url%%#*}"
  # Strip .git suffix
  url="${url%.git}"
  # Extract org/repo (handles https://github.com/org/repo/anything/else)
  echo "$url" | sed -E 's|.*github\.com[:/]([^/]+)/([^/]+).*|\1/\2|'
}

# Detect package manager and install
install_dependencies() {
  local dir="$1"
  cd "$dir" || return

  if [[ -f "pnpm-lock.yaml" ]]; then
    pnpm install
  elif [[ -f "yarn.lock" ]]; then
    yarn install
  elif [[ -f "package-lock.json" ]]; then
    npm install
  elif [[ -f "bun.lockb" ]]; then
    bun install
  elif [[ -f "package.json" ]]; then
    # Default to pnpm if no lockfile but package.json exists
    pnpm install
  fi
}

# Main
url=$(get_github_url)

if [[ -z "$url" || "$url" != *"github.com"* ]]; then
  echo "No GitHub URL found in Chrome or clipboard"
  exit 1
fi

org_repo=$(parse_github_url "$url")
org=$(echo "$org_repo" | cut -d'/' -f1)
repo=$(echo "$org_repo" | cut -d'/' -f2)

if [[ -z "$org" || -z "$repo" ]]; then
  echo "Could not parse org/repo from URL: $url"
  exit 1
fi

target_dir="$HOME/Code/$org/$repo"

if [[ -d "$target_dir" ]]; then
  echo "Pulling latest for $org/$repo..."
  cd "$target_dir" && git pull
else
  echo "Cloning $org/$repo..."
  mkdir -p "$HOME/Code/$org"
  git clone "https://github.com/$org/$repo.git" "$target_dir"
fi

install_dependencies "$target_dir"

code "$target_dir"

echo "Opened $org/$repo in VS Code"
