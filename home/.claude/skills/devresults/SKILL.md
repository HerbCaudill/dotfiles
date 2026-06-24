---
name: devresults
description: Use when working on the DevResults .NET/SQL Server application from macOS through the Parallels Windows VM.
---

# DevResults

## Overview

DevResults is a Windows-native .NET/SQL Server application. Treat the Parallels Windows VM as the source of truth for the working tree, git, builds, tests, IIS Express, and SQL Server behavior. Use macOS as the orchestration layer.

## Quick Reference

| Need                  | Default approach                                        |
| --------------------- | ------------------------------------------------------- |
| Work in the repo      | SSH to `devresults-vm` and run commands inside Windows  |
| Query dev SQL Server  | Use the `sql-server-dev` skill from macOS               |
| Run the web app       | Use IIS Express in the Windows VM                       |
| Test browser behavior | Open the VM-hosted app URL from macOS when reachable    |
| Edit files            | Prefer edits in the Windows checkout, not a macOS clone |
| Repo instructions     | Read `CLAUDE.md` from the DevResults repo root          |
| Repo-specific skills  | Check `.claude/skills` inside the DevResults repo       |

## SSH

The macOS SSH config has:

```sshconfig
Host devresults-vm
    HostName 10.211.55.3
    User herbcaudill
```

Check connectivity with:

```bash
ssh devresults-vm '$PSVersionTable.PSVersion.ToString(); hostname; whoami; Get-Location'
```

The default SSH shell is Windows PowerShell 5.1, so use PowerShell syntax for remote commands.

## Working Pattern

1. SSH into `devresults-vm`.
2. Find or enter the DevResults checkout on the Windows filesystem.
3. Read the repo root `CLAUDE.md` before making changes.
4. Check the repo's `.claude/skills` directory and use any relevant repo-specific skills.
5. Run `git status` before changing files.
6. Keep git, builds, tests, and IIS Express commands inside Windows unless there is a clear reason not to.
7. Use macOS tools only for host-side checks, SQL access, or browser verification against the VM-hosted app.

## Guardrails

- Do not make a second macOS clone the canonical working tree.
- Avoid Parallels shared folders for git-owned source if line endings, casing, or path behavior matter.
- Do not normalize line endings broadly unless the user explicitly asks for a dedicated normalization change.
- Do not assume Unix shell syntax works over SSH; the login shell is PowerShell.
- Keep SQL credentials out of skill files and command output.
