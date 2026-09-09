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

2. **Porkbun API credentials** available in `~/.secrets`:

   ```bash
   source ~/.secrets
   ```

   The file should contain `PORKBUN_API_KEY` and `PORKBUN_SECRET_KEY`.
   Get these from https://porkbun.com/account/api

   See the `porkbun` skill for working with the Porkbun API beyond this script.

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
3. Query Vercel API for project-specific CNAME
4. Add/update CNAME record in Porkbun with the project-specific value

## After Running Setup Script

Before triggering a deployment, apply the Beads branch guard below if the repository uses Beads or Dolt. The setup script does not configure this guard.

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
   # Should return: <hash>.vercel-dns-xxx.com.
   ```

4. **Check the site** at `https://<project-name>.herbcaudill.com`

## Beads and Dolt metadata branches

Beads projects that sync through Dolt can push a `__dolt_remote_info__` branch containing only `DOLT_REMOTE.md`. Vercel treats that push as an app preview and fails with errors such as `vite: command not found`. Older Beads setups may also use a `beads-sync` branch.

For every Beads/Dolt project, configure Vercel's project-level **Ignored Build Step** before the next sync. Use this inline command:

```sh
case "$VERCEL_GIT_COMMIT_REF" in __dolt_remote_info__|beads-sync) exit 0 ;; *) exit 1 ;; esac
```

Vercel interprets exit code `0` as skip and `1` as proceed. This preserves production builds and ordinary feature previews. Add any custom metadata-only sync branch after checking the repository's configuration; do not exclude app branches just because their names contain `beads` or `dolt`.

Set the command in the project's Ignored Build Step settings, or PATCH `/v9/projects/{projectId}?teamId={teamId}` with the `commandForIgnoringBuildStep` field. Read the existing setting first. If it already contains a command, put the metadata-branch check before it and retain its behavior for other branches. Use the authenticated Vercel CLI or API without printing credentials. Read the setting back after updating it.

Keep this guard in the Vercel project settings. A `vercel.json` or script committed only to the app branch is absent from the metadata branch and cannot protect it. Do not edit or delete the Dolt-managed branch to fix deployment failures.

Verify the command returns `0` for each excluded branch and `1` for `main`, a feature branch, and an unset ref (unless an existing ignore rule intentionally changes those outcomes). When a metadata push next occurs, confirm that Vercel cancels/skips the build before dependency installation. Existing failed deployments remain in the history; do not redeploy them as apps.

References: [Vercel Ignored Build Step](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel), [project settings API](https://vercel.com/docs/rest-api/projects/update-an-existing-project).

## Troubleshooting

| Issue                     | Fix                                                                |
| ------------------------- | ------------------------------------------------------------------ |
| "Missing PORKBUN_API_KEY" | Run `source ~/.secrets` first                                      |
| Domain already added      | Safe to ignore, script continues                                   |
| DNS not propagating       | Wait 5-10 minutes, check with `dig <project-name>.herbcaudill.com` |
| Vercel not linked         | Run `vercel login` first                                           |
