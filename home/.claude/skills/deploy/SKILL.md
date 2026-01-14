---
name: deploy
description: Deploy a project to Vercel with a custom domain and Porkbun DNS configuration
user_invocation: deploy [project-name]
---

# Deploy to Vercel

## Overview

Deploys `herbcaudill/<project-name>` to `<project-name>.herbcaudill.com` by linking the repo to Vercel and configuring Porkbun DNS.

## Usage

`/deploy` - deploys current project (when in `~/code/herbcaudill/<project>`)
`/deploy <project-name>` - deploys specified project

Example: `/deploy myproject` deploys to `myproject.herbcaudill.com`

## Prerequisites

1. **Vercel CLI** installed and authenticated:
   ```bash
   pnpm add -g vercel
   vercel login
   ```

2. **Porkbun API credentials** set as environment variables:
   ```bash
   export PORKBUN_API_KEY="pk1_..."
   export PORKBUN_SECRET_KEY="sk1_..."
   ```
   Get these from https://porkbun.com/account/api

## Process

Run the setup script (from project directory, or specify name):

```bash
~/.claude/skills/deploy/setup-vercel-domain.ts
# or
~/.claude/skills/deploy/setup-vercel-domain.ts <project-name>
```

The script will:
1. Link the Vercel project to `herbcaudill/<project-name>`
2. Add `<project-name>.herbcaudill.com` to Vercel
3. Add CNAME record to Porkbun: `<project-name>` → `cname.vercel-dns.com`

## After Running Setup Script

1. **Trigger a production deployment:**
   ```bash
   vercel --prod --yes
   ```

2. **Add domain to the project** (if not already attached):
   ```bash
   vercel domains add <project-name>.herbcaudill.com
   ```

3. **Verify DNS propagation:**
   ```bash
   dig <project-name>.herbcaudill.com CNAME +short
   # Should return: cname.vercel-dns.com.
   ```

4. **Check the site** at `https://<project-name>.herbcaudill.com`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Missing PORKBUN_API_KEY" | Set env vars or add to ~/.zshrc |
| Domain already added | Safe to ignore, script continues |
| DNS not propagating | Wait 5-10 minutes, check with `dig <project-name>.herbcaudill.com` |
| Vercel not linked | Run `vercel login` first |
