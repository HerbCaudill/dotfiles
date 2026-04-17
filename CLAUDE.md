This repo manages global configuration files using symlinks from `home/` into `~/`.

## Key commands

```bash
# Install/update all symlinks
./scripts/symlink.mjs

# Run unit tests for repo-managed automation scripts
pnpm test

# Format the repo
pnpm format

# Re-run symlink.mjs when needed for managed files to take effect immediately
```

## Lightweight workflow for trivial dotfile edits

For trivial, localized dotfile edits such as adding a shell alias, changing a small config value, or fixing a typo:

- edit the relevant file directly
- do not use planning or brainstorming workflows
- do not run repo-wide tests or formatters unless they are relevant to the touched file
- do not re-run `./scripts/symlink.mjs` unless the change needs to take effect immediately in the live home directory
- do not update `README.md` or instruction files unless the change affects durable guidance
- prefer the smallest possible verification step, if any

## How Symlinks Work

- `scripts/symlink.mjs` symlinks individual files from `home/` to `~/`
- Paths in `.symlinks` are linked as whole directories instead (currently `.claude/skills` and `.claude/agents`)
- Extra symlinks: `~/.codex/AGENTS.md` and `~/.pi/agent/AGENTS.md` → `.claude/CLAUDE.md`; `~/.codex/skills` and `~/.pi/agent/skills` → `.claude/skills`
- Repo-managed pi settings live at `home/.pi/agent/settings.json` and symlink to `~/.pi/agent/settings.json`
- Repo-managed beads defaults live at `home/.config/bd/config.yaml` and symlink to `~/.config/bd/config.yaml`
- Because `~/.claude/skills` points at `home/.claude/skills`, global `npx skills add ... -g` installs land in this repo and are automatically shared with Claude Code, Codex, and pi

## Structure

- `home/` — all managed dotfiles, mirroring `~/` structure
  - `.claude/` — Claude Code config: `CLAUDE.md` (global instructions), `settings.json`, `statusline.js`, `skills/`, `agents/`
    - `skills/news-briefing/` includes Node-runnable TypeScript extractor scripts: `extract_article.ts` and `extract_headlines.ts`
  - `.pi/agent/settings.json` — pi global settings managed by this repo
  - `.config/bd/config.yaml` — global beads defaults (shared Dolt server on port 3308)
  - `.local/bin/` — CLI tools: worktree helpers (`wt`, `wtt`, `wtcd`, etc.), sprite tools, `beads`, `serena`, etc.
  - `.zshrc`, `.gitconfig`, `.gitignore`, `.prettierrc`, `.asdfrc` — shell and tool config
  - `.oh-my-zsh/custom/themes/herb.zsh-theme` — custom Zsh theme
  - `Library/LaunchAgents/` — macOS launch agents (e.g., `beads-shared-server`, `gh-sync`, `github-pr-task-sync`)
- `scripts/` — `symlink.mjs` (installer), sprite setup scripts, Raycast commands
- `.symlinks` — lists paths to symlink as directories rather than individual files

## CLI Scripts (`home/.local/bin/`)

All symlinked to `~/.local/bin/`.

### Worktree helpers (Bash)

| Command                   | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `wt <branch> [base]`      | Create worktree with new branch                            |
| `wtt <branch>`            | Create worktree tracking existing branch                   |
| `wtcd [branch]`           | Output worktree path (no args = main repo)                 |
| `wtls`                    | List worktrees with branch names and dirty markers         |
| `wtrm <branch> [-f] [-k]` | Remove worktree and optionally its branch                  |
| `wtclean`                 | Interactively remove worktrees for merged branches         |
| `wtclone <url> [name]`    | Clone repo optimized for worktrees (bare + git file setup) |
| `_wt_dir`                 | Helper: outputs worktree directory path for current repo   |

### Sprite / OpenClaw (Node.js)

OpenClaw docs: https://docs.openclaw.ai/

| Command         | Description                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| `sprite`        | Compiled Go binary for creating/managing isolated Linux environments                       |
| `spc`           | Create a sprite with setup, then open a console session                                    |
| `flyoc`         | Provision OpenClaw on Fly.io (app/volume creation, secrets, deploy, setup, Codex defaults) |
| `_sp_setup.mjs` | Shared sprite setup helper: checks gh auth, creates sprite, runs remote setup              |

### Other tools

| Command                          | Description                                                                                                                      | Language |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `agent-transcripts-sync`         | Sync raw local Claude Code, Codex, and Pi transcript stores into `~/Code/HerbCaudill/agent-transcripts` and commit changes there | Node.js  |
| `install-agent-transcripts-cron` | Install/update a managed cron entry that runs `agent-transcripts-sync` every 15 minutes                                          | Node.js  |
| `github-pr-task-sync`            | Poll GitHub notifications and create Google Tasks for assigned/review-requested PRs                                              | Node.js  |
| `beads`                          | Symlink to `bd` (issue tracking)                                                                                                 | Symlink  |
| `claude`                         | Symlink to Claude Code                                                                                                           | Symlink  |
| `gh-sync`                        | Sync `~/Code/HerbCaudill` with all repos on github.com/HerbCaudill                                                               | Bash     |
| `serena`                         | Invoke Serena CLI                                                                                                                | Python   |
| `serena-mcp-server`              | Start the Serena MCP server                                                                                                      | Python   |
| `index-project`                  | Invoke Serena's project indexing                                                                                                 | Python   |

## Important: Global vs Project CLAUDE.md

`home/.claude/CLAUDE.md` is the shared global agent instructions file. It is symlinked to `~/.claude/CLAUDE.md` for Claude Code, `~/.codex/AGENTS.md` for Codex, and `~/.pi/agent/AGENTS.md` for pi. Likewise, `home/.claude/skills` is shared with Codex and pi. The root `CLAUDE.md` in this repo is project-specific instructions for working within this dotfiles repo itself.

## Installing shared agent skills

Use `npx skills add ... -g --copy` when you want a third-party skill written into the shared global skills directory managed by this repo.

```bash
npx skills add https://github.com/googleworkspace/cli \
  --skill gws-gmail \
  -g -a claude-code --copy -y
```

Because `~/.claude/skills` is a symlink to `home/.claude/skills`, this updates the repo-managed files directly and the same skill becomes available to Codex and pi through their shared symlinks.

## Marvin (OpenClaw on Fly.io)

Marvin is an OpenClaw agent running on Fly.io as `herbcaudill-marvin` (CDG/Paris region).

```bash
# SSH into Marvin's VM
fly ssh console --app herbcaudill-marvin

# Run a single command
fly ssh console --app herbcaudill-marvin --command "ls /data"
```

- **Alias:** `marvin` (defined in `.zshrc`) opens an SSH console
- **Provisioning:** `flyoc` script handles full setup (app, volume, secrets, deploy, bootstrap)
- **Model defaults:** `openai/gpt-5-codex` (primary), `openai/codex-mini-latest` (fallback)
- **Bootstrap repo:** `../marvin-bootstrap` (github.com/HerbCaudill/marvin-bootstrap)
- **Data volume:** persistent at `/data` (1GB)
- **Dashboard:** `https://herbcaudill-marvin.fly.dev/#token=...`
- **Secrets:** read from `~/.secrets`

## Issue Tracking

This project uses **bd** (beads) for issue tracking.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## GitHub PR task sync

The dotfiles repo manages GitHub-to-Google-Tasks automation with:

- `github-pr-task-sync`, a Node-based script that polls GitHub notifications and creates Google Tasks for pull requests where Herb is assigned or requested as a reviewer
- `home/Library/LaunchAgents/com.herbcaudill.github-pr-task-sync.plist`, which runs the sync every 60 seconds and logs to `/tmp/github-pr-task-sync.log`
- Persistent state in `~/.local/share/github-pr-task-sync/state.json` so repeated polls do not recreate the same task for the same notification update

Tasks are created in the default Google Tasks list with title `PR: {title}` and the PR URL in the notes.

## Agent transcript archive

The dotfiles repo manages two commands for archiving local AI transcripts:

- `agent-transcripts-sync` copies raw Claude Code, Codex, and Pi transcript artifacts from `~/.claude`, `~/.codex`, and `~/.pi` into `~/Code/HerbCaudill/agent-transcripts`
- `install-agent-transcripts-cron` installs a managed cron block that runs the sync every 15 minutes and logs to `/tmp/agent-transcripts-sync.log`

Codex does not currently expose a clean flat session transcript file on disk in this environment, so the archive preserves Codex's raw local stores directly: `history.jsonl`, `state_5.sqlite*`, and `logs_1.sqlite*`. Pi session transcripts are archived from `~/.pi/agent/sessions/**/*.jsonl`.

## User bio

I'm an American citizen living in Barcelona. My wife, Lynne, is a therapist with a doctorate in anthropology; she specializes in maternal mental health. We have two boys: Calvin is 21; he's in college in the US. Ashe is 18 and is living at home while he plots his next move. We rent an apartment in Barcelona and own a house in Tamariu on the Costa Brava. I own a small software company, DevResults, which makes monitoring & evaluation software for foreign aid projects. It's a small company with 9 employees including me. I still work as a programmer, mostly in TypeScript. I speak English, Spanish, Catalan, and French.
