---
name: personal-info
description: Use when a task needs Herb's identity, contact, address, document, loyalty information, or an approved low-stakes account credential.
---

# Personal info

Read [personal-info.md](personal-info.md) for the requested information. Treat the entire file as sensitive: use only the fields needed for the task, and never print its contents in logs, commentary, summaries, or command output.

The 1Password Secure Note is the source of truth; `personal-info.md` is an ignored local mirror. If the mirror is missing or Herb asks to refresh it, run `personal-info-sync pull`. Only run `personal-info-sync push` when Herb explicitly asks to update 1Password from the local mirror.

If synchronization triggers biometric unlock, wait up to 60 seconds. Never ask Herb for a 1Password password, secret key, recovery code, or one-time password.

## Low-stakes passwords

Herb approved plaintext storage for low-stakes account passwords on November 17, 2026. [low-stakes-passwords.json](low-stakes-passwords.json) lives beside `personal-info.md`. It is a Git-ignored, machine-local file, independent of the 1Password mirror. On macOS, keep its permissions at `0600`. Never commit it or copy credentials into notes, skill instructions, logs, or conversation output.

The JSON is an object keyed by the site's hostname. Each entry contains `url` and `password`, plus `username` when known. Parse only the requested site's entry within the command or tool that needs it; do not print the file or its secrets. Use credentials only for a task Herb has authorized, on the matching site, and within the current harness and tool rules. Storing a credential does not authorize bookings, purchases, or other account changes. If a value is missing, use the available secret-input tool to request it. Do not guess a missing username from an unrelated contact address.
