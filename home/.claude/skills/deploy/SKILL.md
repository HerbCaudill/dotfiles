---
name: deploy
description: Deploy a project to Vercel with a custom domain and Porkbun DNS configuration
user_invocation: deploy <repo> <domain>
---

# Deploy to Vercel

## Overview

Sets up a Vercel project linked to a GitHub repo, adds a custom domain, and configures Porkbun DNS automatically.

## Usage

`/deploy <repo> <domain>`

Examples:
- `/deploy herbcaudill/myproject example.com`
- `/deploy herbcaudill/foo foo.dev`

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

Run the setup script:

```bash
setup-vercel-domain.ts <repo> <domain>
```

The script will:
1. Link the Vercel project to the GitHub repo
2. Add the domain to Vercel
3. Get the verification TXT record from Vercel
4. Add DNS records to Porkbun:
   - TXT record for `_vercel` (verification)
   - CNAME record for `www` → `cname.vercel-dns.com`
   - A record for `@` → `76.76.21.21`

## After Deployment

1. **Verify DNS propagation:**
   ```bash
   vercel domains inspect <domain>
   ```

2. **Trigger a deployment** (if not automatic):
   ```bash
   vercel --prod
   ```

3. **Check the site** at `https://<domain>`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Missing PORKBUN_API_KEY" | Set env vars or add to ~/.zshrc |
| Domain already added | Safe to ignore, script continues |
| DNS not propagating | Wait 5-10 minutes, check with `dig <domain>` |
| Vercel not linked | Run `vercel login` first |
