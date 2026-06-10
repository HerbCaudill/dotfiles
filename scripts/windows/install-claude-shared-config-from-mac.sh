#!/usr/bin/env bash
set -euo pipefail

VM_NAME="${VM_NAME:-Windows 11}"
WINDOWS_USER="${WINDOWS_USER:-herbcaudill}"
WINDOWS_USER_PROFILE="${WINDOWS_USER_PROFILE:-C:\\Users\\$WINDOWS_USER}"
SCRIPT_PATH="\\\\Mac\\Home\\Code\\HerbCaudill\\dotfiles\\scripts\\windows\\install-claude-shared-config.ps1"

if ! command -v prlctl >/dev/null 2>&1; then
  echo "prlctl is not installed; skipping Windows Claude config sync."
  exit 0
fi

if ! prlctl list "$VM_NAME" -i 2>/dev/null | grep -q "^State: running$"; then
  echo "$VM_NAME is not running; skipping Windows Claude config sync."
  exit 0
fi

prlctl exec "$VM_NAME" \
  powershell \
  -NoProfile \
  -ExecutionPolicy Bypass \
  -File "$SCRIPT_PATH" \
  -UserProfile "$WINDOWS_USER_PROFILE"
