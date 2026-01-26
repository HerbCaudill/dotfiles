---
name: sprites
description: Run commands in isolated Linux environments using sprites.dev. Use for code execution, testing, or running untrusted code in a sandbox.
user_invocation: sprites [command]
---

# Sprites

## Overview

Sprites are persistent, hardware-isolated Linux environments for running arbitrary code. They hibernate when idle (no compute cost) and wake instantly. Useful for:

- Running untrusted code in a sandbox
- Testing in isolated environments
- Persistent dev environments
- Running long-running services

## Prerequisites

1. **Sprite CLI installed:**
   ```bash
   curl https://sprites.dev/install.sh | bash
   ```

2. **Authenticated:**
   ```bash
   sprite login
   ```

## Quick Reference

### Create and use a sprite

```bash
# Create a new sprite
sprite create my-sprite

# Activate for current directory (remembers sprite name)
sprite use my-sprite

# After 'use', commands work without -s flag
sprite exec ls -la
sprite console
```

### Execute commands

```bash
# Run a command
sprite exec ls -la
sprite exec -s my-sprite npm install

# Run with environment variables
sprite exec -env NODE_ENV=production,DEBUG=true npm start

# Run in specific directory
sprite exec -dir /app npm test

# Upload a file before running
sprite exec -file ./script.sh:/tmp/script.sh bash /tmp/script.sh

# Interactive shell
sprite console
sprite c
```

### Checkpoints

```bash
# Create a checkpoint (snapshot current state)
sprite checkpoint create

# List checkpoints
sprite checkpoint list

# Restore to a checkpoint
sprite restore <checkpoint-id>

# Get checkpoint info
sprite checkpoint info <checkpoint-id>
```

### Port forwarding

```bash
# Forward local ports through sprite
sprite proxy 8080 3000

# Get sprite's public URL
sprite url

# Make URL public (no auth)
sprite url update --auth public
```

### Management

```bash
# List all sprites
sprite list

# Destroy sprite
sprite destroy
```

## Typical Workflows

### Sandbox for untrusted code

```bash
sprite create sandbox
sprite exec -file ./untrusted.py:/tmp/code.py python3 /tmp/code.py
sprite restore v1  # Roll back after execution
```

### Persistent dev environment

```bash
sprite create dev-env
sprite console

# Inside sprite: install tools, clone repos, etc.
# State persists across sessions

# Checkpoint clean state
sprite checkpoint create
```

### Test in isolation

```bash
sprite create test-env
sprite exec -file ./package.json:/app/package.json -dir /app npm install
sprite exec -dir /app npm test
sprite destroy
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Persistence** | ext4 filesystem persists between runs |
| **Hibernation** | Auto-sleeps after 30s idle, zero cost |
| **Checkpoints** | Snapshot and restore in ~300ms |
| **HTTP access** | Each sprite gets a unique URL |
| **Isolation** | Firecracker microVMs, isolated networks |
| **Resources** | Up to 8 vCPUs, 8GB RAM, 100GB storage |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "sprite not found" | Run `sprite login` first |
| Slow first command | Sprite waking from hibernation (normal) |
| Need to persist env vars | Add to `~/.bashrc` in sprite |
| Port not accessible | Use `sprite proxy` or check `sprite url` |
