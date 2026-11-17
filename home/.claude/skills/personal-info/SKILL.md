---
name: personal-info
description: Use when a task needs Herb's identity, contact, address, document, loyalty information, or an approved low-stakes account credential.
---

# Personal info

Read [personal-info.md](personal-info.md) for the requested information. Treat the entire file as sensitive: use only the fields needed for the task, and never print its contents in logs, commentary, summaries, or command output.

The 1Password Secure Note is the source of truth; `personal-info.md` is an ignored local mirror. If the mirror is missing or Herb asks to refresh it, run `personal-info-sync pull` on the Mac. This refreshes the Mac file and copies both private files to the mini. Only run `personal-info-sync push` when Herb explicitly asks to update 1Password from the Mac mirror.

If synchronization triggers biometric unlock, wait up to 60 seconds. Never ask Herb for a 1Password password, secret key, recovery code, or one-time password.

## Low-stakes passwords

Herb approved plaintext storage for low-stakes account passwords on November 17, 2026. [low-stakes-passwords.json](low-stakes-passwords.json) lives beside `personal-info.md`. The Mac copy is authoritative, independent of the 1Password mirror, and copied one way to the mini. Both copies are Git-ignored. On macOS, keep its permissions at `0600`; the mini receiver restricts its Windows ACL to Herb's account. Never commit it or copy credentials into notes, skill instructions, logs, or conversation output.

The JSON is an object keyed by the site's hostname. Each entry contains `url` and `password`, plus `username` when known. Parse only the requested site's entry within the command or tool that needs it; do not print the file or its secrets. Use credentials only for a task Herb has authorized, on the matching site, and within the current harness and tool rules. Storing a credential does not authorize bookings, purchases, or other account changes. If a value is missing, use the available secret-input tool to request it. Do not guess a missing username from an unrelated contact address.

## Syncing the mini

Make changes on the Mac, then run `personal-info-sync mini` there for immediate delivery. This copies the two complete private files over Tailscale SSH, verifies hashes, and never accesses 1Password or logs their contents. The mini destinations are in `C:\Code\HerbCaudill\dotfiles\home\.claude\skills\personal-info`. Do not edit the mini copies; later deliveries overwrite them.

The Mac LaunchAgent `com.herbcaudill.personal-files-sync` runs at login, watches both files and their directory, and retries every five minutes while the Mac is awake. If delivery fails, the existing mini files remain usable and the job retries. Inspect `/tmp/personal-files-sync.log` for errors. Missing or empty source files and malformed password JSON stop delivery; deleting a Mac file does not delete its mini copy. The sync helper may read and transfer the complete files, but never print their contents. On the mini, request changes or a refresh through the Mac; if it is asleep or unreachable, report that the update is pending rather than claiming the mirror is current.
