---
name: onepassword
description: Use when a task needs secrets from 1Password, the op CLI, credentials, API keys, tokens, passwords, vault items, secret references, or a command that requires secret-backed environment variables.
---

# 1Password CLI

Use the `op` CLI to read secrets without exposing them. Default to read-only access.

## Hard Rules

- Never print, echo, quote, log, summarize, or include secret values in final output.
- Prefer `op run` with `op://` references over `op read`; use `op read` only when a tool cannot consume references.
- Treat vault names, item titles, URLs, usernames, tags, and field names as sensitive metadata. Return the minimum needed reference map.
- Do not create, edit, delete, or reorganize 1Password items.
- Do not inspect, migrate, rewrite, or replace `~/.secrets` unless the user explicitly asks in that task.
- Do not create plaintext secret files unless there is no alternative. If required, use a private temp directory, restrictive permissions, immediate cleanup, and no content logging.
- Do not copy secrets to the clipboard unless the user explicitly asks.

## Authentication

Check availability with:

```bash
command -v op && op --version
```

Check sign-in state with harmless commands such as `op account list` or `op whoami`.

If `op` triggers biometric unlock, wait up to 60 seconds for the user to approve it. If it still has not completed, report that the task is blocked until local 1Password unlock is completed. Never ask for a password, secret key, recovery code, or one-time password in chat.

If `op` is missing or too old for the needed feature, report the blocker and the install/update path; do not install security tooling automatically.

## Safe Patterns

Prefer environment files containing unresolved references:

```bash
op run --env-file .env.op -- pnpm deploy
```

`.env.op` may contain references, not values:

```bash
PORKBUN_API_KEY=op://Private/Porkbun API/api key
PORKBUN_SECRET_KEY=op://Private/Porkbun API/secret key
```

For one-off commands, keep references in the command boundary:

```bash
API_TOKEN='op://Private/Service/token' op run -- sh -c 'tool --token "$API_TOKEN"'
```

Use `op read` only as a last resort, and pass it directly to a consumer:

```bash
op read 'op://Private/Service/token' | tool login --token-stdin
```

When using `op read`, pass the value directly into the consuming command without printing it, and redact any accidental output.

## Metadata Discovery

When the needed item or field name is unknown, limited metadata discovery is allowed:

```bash
op vault list
op item list --vault Private
op item get 'Item title' --vault Private --format json
```

Do not paste full item JSON into chat. Extract only the minimal vault/item/field references needed to continue, such as:

```text
op://Private/Porkbun API/api key
op://Private/Porkbun API/secret key
```

When available, prefer a no-network subagent for exploratory metadata discovery. The subagent should return only the minimal reference map, not usernames, URLs, notes, tags, field values, or full JSON.

## Clipboard

Only copy a secret when the user explicitly requests clipboard use:

```bash
op read 'op://Private/Service/token' | pbcopy
```

Do not print the value. Tell the user it was copied and recommend clearing the clipboard when done.

## Unsafe Patterns

Avoid these:

```bash
echo "$(op read 'op://Private/Service/token')"
export API_TOKEN="$(op read 'op://Private/Service/token')"
op item get 'Item title' --format json
op read 'op://Private/Service/token' > .env
```

If a command unexpectedly prints a secret, do not repeat the output. Say that secret output was redacted and continue with a safer pattern.
