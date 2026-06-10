#!/usr/bin/env bash
set -euo pipefail

VM_NAME="${VM_NAME:-Windows 11}"
WINDOWS_USER="${WINDOWS_USER:-herbcaudill}"
WINDOWS_USER_PROFILE="${WINDOWS_USER_PROFILE:-C:\\Users\\$WINDOWS_USER}"
SCRIPT_PATH="\\\\Mac\\Home\\Code\\HerbCaudill\\dotfiles\\scripts\\windows\\install-claude-shared-config.ps1"

prlctl exec "$VM_NAME" \
  powershell \
  -NoProfile \
  -ExecutionPolicy Bypass \
  -File "$SCRIPT_PATH" \
  -UserProfile "$WINDOWS_USER_PROFILE"
