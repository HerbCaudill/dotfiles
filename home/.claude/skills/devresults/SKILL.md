---
name: devresults
description: Use when working on the DevResults .NET/SQL Server application from macOS through the Parallels Windows VM.
---

# DevResults

## Overview

DevResults is a Windows-native .NET/SQL Server application. Treat the Parallels Windows VM as the source of truth for the working tree, git, builds, tests, IIS Express, and SQL Server behavior. Use macOS as the orchestration layer.

## Quick Reference

| Need                  | Default approach                                       |
| --------------------- | ------------------------------------------------------ |
| Work in the repo      | SSH to `devresults-vm` and run commands inside Windows |
| Query dev SQL Server  | Use the `sql-server-dev` skill from macOS              |
| Run the web app       | Use IIS Express in the Windows VM                      |
| Test browser behavior | Open the VM-hosted app URL from macOS when reachable   |
| Edit files            | Edit inside the Windows VM checkout only               |
| Repo instructions     | Read `CLAUDE.md` from the DevResults repo root         |
| Repo-specific skills  | Check `.claude/skills` inside the DevResults repo      |
| Common repo commands  | Use `dr <command>` from macOS                          |

## Hard Rule: Never Use macOS Mounts for Repo Files

When working on DevResults from macOS, do not read, edit, patch, format, test, stage, commit, or run git against repo files through `/Volumes/[C] Windows 11/...` or any other Parallels shared-folder path.

If a DevResults path begins with `/Volumes/`, stop and switch to the Windows VM:

```bash
dr git status --short
```

Do not use `apply_patch` against the mounted Windows checkout. It can create AppleDouble `._*` files and disturb line endings. All source edits must happen inside the Windows VM.

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

## `dr` Helper

From macOS, use `dr` to run commands from `C:\Code\DevResults` inside the Windows VM:

```bash
dr git status --short
dr pnpm test
dr git add DevResults/Web/Scripts/ng/directives/ReportTemplateIndex.html
dr git commit -m "ReportTemplateIndex: shrink template thumbnails"
```

For patch-style edits, apply the patch inside Windows:

```bash
dr git apply --whitespace=nowarn -
```

Pipe the patch on stdin. After applying, immediately run:

```bash
dr git status --short
```

## Working Pattern

1. SSH into `devresults-vm`.
2. Find or enter the DevResults checkout on the Windows filesystem.
3. Read the repo root `CLAUDE.md` before making changes.
4. Check the repo's `.claude/skills` directory and use any relevant repo-specific skills.
5. Run `git status` before changing files.
6. Keep git, source inspection, edits, builds, tests, and IIS Express commands inside Windows unless there is a clear reason not to.
7. Use macOS tools only for host-side checks, SQL access, or browser verification against the VM-hosted app.

## Local TLS for `*.devlocal.us`

`*.devlocal.us` is served by IIS Express/HTTP.sys in the Windows VM using a local Let's Encrypt wildcard certificate. Cloudflare is only used for DNS-01 validation through Posh-ACME; the certificate itself is stored in the VM's LocalMachine certificate store and bound to `0.0.0.0:443`.

When Chrome shows certificate warnings for `*.devlocal.us`, first check the served certificate from macOS:

```bash
printf '' | openssl s_client -connect inl.devlocal.us:443 -servername inl.devlocal.us -showcerts 2>/tmp/devlocal_sclient.err | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

On the VM, inspect the local cert and HTTP.sys binding:

```powershell
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*devlocal*" } | Select-Object Subject,Issuer,NotBefore,NotAfter,Thumbprint
netsh http show sslcert ipport=0.0.0.0:443
```

The DevResults wiki documents renewal by re-running the TLS setup script from an elevated Windows PowerShell prompt:

```powershell
cd C:\Code\DevResults
powershell -ExecutionPolicy Unrestricted .\ConfigureTls.ps1
```

Use the Cloudflare API token from 1Password when prompted. The certificate expires about every 3 months, so this is expected recurring maintenance.

If renewing over SSH, note that the saved Posh-ACME `pluginargs.json` may fail to decrypt with `Key not valid for use in specified state` because DPAPI state differs from the original interactive Windows session. In that case, prefer the documented elevated PowerShell flow. If a remote workaround is necessary, back up `C:\Users\herbcaudill\AppData\Local\Posh-ACME\LE_PROD\3184500871\devlocal.us\pluginargs.json`, renew with a fresh Cloudflare token, bind the returned thumbprint to `0.0.0.0:443`, then restore the original encrypted `pluginargs.json` so the token is not left on disk in plain form.

## Guardrails

- Do not make a second macOS clone of the canonical working tree.
- Never write through the mounted `C:` volume. macOS can create AppleDouble sidecar files like `._Web.config`; if they appear during a task, delete only those generated sidecars before finishing.
- Avoid Parallels shared folders for git-owned source if line endings, casing, or path behavior matter.
- Do not normalize line endings broadly unless the user explicitly asks for a dedicated normalization change.
- Do not assume Unix shell syntax works over SSH; the login shell is PowerShell.
- Keep SQL credentials out of skill files and command output.
