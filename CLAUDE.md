A dotfiles repo that manages global configuration files via symlinks from `home/` to `~/`. Everything under `home/` mirrors the home directory structure.

## Key Commands

```bash
# Install/update all symlinks
./scripts/symlink.mjs

# After editing any file in home/, re-run symlink.mjs to ensure links are current
```

There are no build, lint, or test commands — this is a config-only repo.

## How Symlinks Work

- `scripts/symlink.mjs` symlinks individual files from `home/` to `~/`
- Paths in `.symlinks` are linked as whole directories instead (currently `.claude/skills` and `.claude/agents`)
- Extra symlinks: `~/.codex/AGENTS.md` → `.claude/CLAUDE.md`, `~/.codex/skills` → `.claude/skills`

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

| Command         | Description                                                                |
| --------------- | -------------------------------------------------------------------------- |
| `sprite`        | Compiled Go binary for creating/managing isolated Linux environments       |
| `spc`           | Create a sprite with setup, then open a console session                    |
| `flyoc`         | Provision OpenClaw on Fly.io (app/volume creation, secrets, deploy, setup) |
| `_sp_setup.mjs` | Shared sprite setup helper: checks gh auth, creates sprite, runs remote setup |

### Other tools

| Command             | Description                                                        | Language |
| ------------------- | ------------------------------------------------------------------ | -------- |
| `beads`             | Symlink to `bd` (issue tracking)                                   | Symlink  |
| `claude`            | Symlink to Claude Code                                             | Symlink  |
| `gh-sync`           | Sync `~/Code/HerbCaudill` with all repos on github.com/HerbCaudill | Bash     |
| `serena`            | Invoke Serena CLI                                                  | Python   |
| `serena-mcp-server` | Start the Serena MCP server                                        | Python   |
| `index-project`     | Invoke Serena's project indexing                                   | Python   |

## Important: Global vs Project CLAUDE.md

`home/.claude/CLAUDE.md` is the **global** Claude Code instructions file (symlinked to `~/.claude/CLAUDE.md`). The root `CLAUDE.md` in this repo is project-specific instructions for working within this dotfiles repo itself.

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
