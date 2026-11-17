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

2. **Porkbun API credentials** in `~/.secrets` as `export PORKBUN_API_KEY=…` and `export PORKBUN_SECRET_KEY=…`. The script loads them itself. Get them from https://porkbun.com/account/api

   See the `porkbun` skill for working with the Porkbun API beyond this script.

## Process

Run the setup script from the project's checkout, or pass the name to use `~/Code/HerbCaudill/<project-name>`. Do a dry run first: it reads everything and prints what it would change.

```bash
~/.claude/skills/deploy/setup-vercel-domain.ts --dry-run
~/.claude/skills/deploy/setup-vercel-domain.ts
# or
~/.claude/skills/deploy/setup-vercel-domain.ts <project-name> [--dry-run]
```

The script works in the `herb-caudills-projects` team and is safe to re-run. Each step reads the current state and changes only what is missing:

1. **Project.** Runs `vercel link --yes --project <name> --scope herb-caudills-projects`, which creates the project and connects the GitHub repo. (`--repo` cannot create a project non-interactively.) The CLI appends env patterns such as `.env*` to `.gitignore`, which would ignore `.env.example`; the script removes them, keeps `.vercel`, and says what it removed. It warns if the project is not connected to the GitHub repo.
2. **Domain.** Attaches `<name>.herbcaudill.com` through the projects API. `vercel domains add` fails with `domain_not_owned` because the domain is registered at Porkbun. Vercel answers with a TXT challenge at `_vercel.herbcaudill.com`; the script adds it to Porkbun alongside the other projects' challenges (never replacing them), then asks Vercel to verify, retrying for about two minutes.
3. **CNAME.** Points a Porkbun CNAME at the top-ranked `recommendedCNAME` from `/v6/domains/{domain}/config` (a project-specific `*.vercel-dns-0xx.com` host). An existing CNAME at any recommended value, including `cname.vercel-dns.com`, is left alone. The older `cnames` field reports current DNS, not a recommendation, so it is empty for a new domain.
4. **Ignored Build Step.** Adds the Beads/Dolt metadata-branch guard described below, keeping any existing command, and reads it back.

It reads the Vercel token from the CLI's `auth.json` (or `VERCEL_TOKEN`) and the Porkbun keys from the environment or `~/.secrets`, and never prints either.

## After running the setup script

1. **Deploy.** Push to `main`, or run `vercel --prod --yes` in the checkout.
2. **Check DNS.** `dig <project-name>.herbcaudill.com CNAME +short` should return the Vercel host.
3. **Check the site** at `https://<project-name>.herbcaudill.com`.

For web apps and PWAs, apply the [mobile-pwa skill](../mobile-pwa/SKILL.md) during verification. Check the live HTML, manifest, icon URLs, waiting-worker update notice, and desktop/mobile rendering. Use an isolated production preview origin for real worker update tests. Report physical iPhone checks separately; browser emulation cannot confirm the installed app's native top blur or keyboard behavior.

## Beads and Dolt metadata branches

Beads projects that sync through Dolt can push a `__dolt_remote_info__` branch containing only `DOLT_REMOTE.md`. Vercel treats that push as an app preview and fails with errors such as `vite: command not found`. Older Beads setups may also use a `beads-sync` branch.

The setup script sets this project-level **Ignored Build Step** for every project, since it is harmless where those branches never appear and Beads may be added later:

```sh
case "$VERCEL_GIT_COMMIT_REF" in __dolt_remote_info__|beads-sync) exit 0 ;; *) exit 1 ;; esac
```

Vercel interprets exit code `0` as skip and `1` as proceed. This preserves production builds and ordinary feature previews. If the project already has a command, the script puts the metadata-branch check in front of it so the existing command still decides for other branches. Add any custom metadata-only sync branch by hand after checking the repository's configuration; do not exclude app branches just because their names contain `beads` or `dolt`. To change it manually, PATCH `/v9/projects/{projectId}?teamId={teamId}` with `commandForIgnoringBuildStep`, reading the existing value first and back afterwards.

Keep this guard in the Vercel project settings. A `vercel.json` or script committed only to the app branch is absent from the metadata branch and cannot protect it. Do not edit or delete the Dolt-managed branch to fix deployment failures.

The script's tests check that the command returns `0` for each excluded branch and `1` for `main`, a feature branch and an unset ref. When a metadata push next occurs, confirm that Vercel cancels/skips the build before dependency installation. Existing failed deployments remain in the history; do not redeploy them as apps.

References: [Vercel Ignored Build Step](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel), [project settings API](https://vercel.com/docs/rest-api/projects/update-an-existing-project).

## Troubleshooting

| Issue                             | Fix                                                                     |
| --------------------------------- | ----------------------------------------------------------------------- |
| "Missing PORKBUN_API_KEY"         | Add the keys to `~/.secrets`                                            |
| "The Vercel CLI is not signed in" | Run `vercel login`                                                      |
| "No git checkout at …"            | Clone the repo to `~/Code/HerbCaudill/<name>` or run from its checkout  |
| Domain still unverified           | The TXT record has not propagated; wait a few minutes and re-run        |
| `domain_already_in_use`           | Another Vercel project has the domain; remove it there first            |
| Project not connected to GitHub   | Connect it under Settings › Git in the Vercel dashboard                 |
| DNS not propagating               | Wait 5–10 minutes, then check with `dig <project-name>.herbcaudill.com` |
