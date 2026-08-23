---
name: personal-info
description: Use when a task needs Herb's identity, contact, address, document, or loyalty information.
---

# Personal info

Read [personal-info.md](personal-info.md) for the requested information. Treat the entire file as sensitive: use only the fields needed for the task, and never print its contents in logs, commentary, summaries, or command output.

The 1Password Secure Note is the source of truth; `personal-info.md` is an ignored local mirror. If the mirror is missing or Herb asks to refresh it, run `personal-info-sync pull`. Only run `personal-info-sync push` when Herb explicitly asks to update 1Password from the local mirror.

If synchronization triggers biometric unlock, wait up to 60 seconds. Never ask Herb for a 1Password password, secret key, recovery code, or one-time password.
