A dotfiles repo that manages global configuration files via symlinks from `home/` to `~/`. Everything under `home/` mirrors the home directory structure.

## Key Commands

```bash
# Install/update all symlinks
./scripts/symlink.mjs

# Run unit tests for repo-managed automation scripts
pnpm test

# Format the repo
pnpm format

# After editing any file in home/, re-run symlink.mjs to ensure links are current
```

## How Symlinks Work

- `scripts/symlink.mjs` symlinks individual files from `home/` to `~/`
- Paths in `.symlinks` are linked as whole directories instead (currently `.claude/skills` and `.claude/agents`)
- Extra symlinks: `~/.codex/AGENTS.md` and `~/.pi/agent/AGENTS.md` → `.claude/CLAUDE.md`; `~/.codex/skills` and `~/.pi/agent/skills` → `.claude/skills`

## Structure

- `home/` — all managed dotfiles, mirroring `~/` structure
  - `.claude/` — Claude Code config: `CLAUDE.md` (global instructions), `settings.json`, `statusline.js`, `skills/`, `agents/`
  - `.local/bin/` — CLI tools: worktree helpers (`wt`, `wtt`, `wtcd`, etc.), sprite tools, `beads`, `serena`, etc.
  - `.zshrc`, `.gitconfig`, `.gitignore`, `.prettierrc`, `.asdfrc` — shell and tool config
  - `.oh-my-zsh/custom/themes/herb.zsh-theme` — custom Zsh theme
  - `Library/LaunchAgents/` — macOS launch agents (e.g., `gh-sync`)
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

| Command                          | Description                                                                                                                 | Language |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| `agent-transcripts-sync`         | Sync raw local Claude Code and Codex transcript stores into `~/Code/HerbCaudill/agent-transcripts` and commit changes there | Node.js  |
| `install-agent-transcripts-cron` | Install/update a managed cron entry that runs `agent-transcripts-sync` every 15 minutes                                     | Node.js  |
| `beads`                          | Symlink to `bd` (issue tracking)                                                                                            | Symlink  |
| `claude`                         | Symlink to Claude Code                                                                                                      | Symlink  |
| `gh-sync`                        | Sync `~/Code/HerbCaudill` with all repos on github.com/HerbCaudill                                                          | Bash     |
| `serena`                         | Invoke Serena CLI                                                                                                           | Python   |
| `serena-mcp-server`              | Start the Serena MCP server                                                                                                 | Python   |
| `index-project`                  | Invoke Serena's project indexing                                                                                            | Python   |

## Important: Global vs Project CLAUDE.md

`home/.claude/CLAUDE.md` is the shared global agent instructions file. It is symlinked to `~/.claude/CLAUDE.md` for Claude Code, `~/.codex/AGENTS.md` for Codex, and `~/.pi/agent/AGENTS.md` for pi. Likewise, `home/.claude/skills` is shared with Codex and pi. The root `CLAUDE.md` in this repo is project-specific instructions for working within this dotfiles repo itself.

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

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Agent transcript archive

The dotfiles repo manages two commands for archiving local AI transcripts:

- `agent-transcripts-sync` copies raw Claude Code and Codex transcript artifacts from `~/.claude` and `~/.codex` into `~/Code/HerbCaudill/agent-transcripts`
- `install-agent-transcripts-cron` installs a managed cron block that runs the sync every 15 minutes and logs to `/tmp/agent-transcripts-sync.log`

Codex does not currently expose a clean flat session transcript file on disk in this environment, so the archive preserves Codex's raw local stores directly: `history.jsonl`, `state_5.sqlite*`, and `logs_1.sqlite*`.

## User bio

I'm an American citizen living in Barcelona. My wife, Lynne, is a therapist with a doctorate in anthropology; she specializes in maternal mental health. We have two boys: Calvin is 21; he's in college in the US. Ashe is 18 and is living at home while he plots his next move. We rent an apartment in Barcelona and own a house in Tamariu on the Costa Brava. I own a small software company, DevResults, which makes monitoring & evaluation software for foreign aid projects. It's a small company with 9 employees including me. I still work as a programmer, mostly in TypeScript. I speak English, Spanish, Catalan, and French.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
