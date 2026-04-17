This repo manages global configuration files with **Nix**, using `nix-darwin` for macOS system state and `home-manager` for user-level config.

## Key commands

```bash
# Apply the full macOS + home configuration
nix run github:LnL7/nix-darwin/master#darwin-rebuild -- \
  switch --flake ~/Code/HerbCaudill/dotfiles#herbcaudill

# Run unit tests for repo-managed automation scripts
pnpm test

# Format the repo
pnpm format
```

## Lightweight workflow for trivial dotfile edits

For trivial, localized edits such as adding a shell alias, changing a small config value, or fixing a typo:

- edit the relevant file directly
- do not use planning or brainstorming workflows
- do not run repo-wide tests or formatters unless they are relevant to the touched file
- re-apply the Nix configuration only when the change needs to take effect immediately
- do not update `README.md` or instruction files unless the change affects durable guidance
- prefer the smallest possible verification step, if any

## How configuration works now

- `flake.nix` is the top-level entry point for the environment
- `nix/darwin/default.nix` owns machine-level macOS configuration such as launchd agents
- `nix/home/` owns user-level config such as zsh, git, packages, and file mappings
- `home/` stores repo-owned source assets like Claude skills, custom scripts, and JSON/YAML config files
- Home Manager uses out-of-store symlinks for live repo-owned assets, so edits in this repo show up directly in `~/`
- Extra harness links are declared in `nix/home/files.nix` (`~/.codex/AGENTS.md`, `~/.pi/agent/AGENTS.md`, skills links, etc.)

## Structure

- `flake.nix` — top-level flake
- `nix/darwin/` — nix-darwin modules
- `nix/home/` — home-manager modules
- `home/` — source assets linked into `~/`
  - `.claude/` — Claude config, skills, and agents
  - `.local/bin/` — CLI scripts and wrappers
  - `.pi/agent/settings.json` — Pi settings
  - `.config/bd/config.yaml` — Beads defaults
  - `.oh-my-zsh/custom/themes/herb.zsh-theme` — custom theme source
  - `iterm2/` — repo-managed iTerm assets
- `scripts/` — repo automation and tests

## CLI scripts (`home/.local/bin/`)

These are installed into `~/.local/bin` by Home Manager rather than a custom symlink script.

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

### Other tools

| Command                          | Description                                                                                                                      | Language |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `agent-transcripts-sync`         | Sync raw local Claude Code, Codex, and Pi transcript stores into `~/Code/HerbCaudill/agent-transcripts` and commit changes there | Node.js  |
| `install-agent-transcripts-cron` | Install/update a managed cron entry that runs `agent-transcripts-sync` every 15 minutes                                          | Node.js  |
| `github-pr-task-sync`            | Poll GitHub notifications and create Google Tasks for assigned/review-requested PRs                                              | Node.js  |
| `beads`                          | Wrapper for `bd`                                                                                                                 | Shell    |
| `gh-sync`                        | Sync `~/Code/HerbCaudill` with all repos on github.com/HerbCaudill                                                               | Bash     |
| `serena`                         | Invoke Serena CLI                                                                                                                | Python   |
| `serena-mcp-server`              | Start the Serena MCP server                                                                                                      | Python   |
| `index-project`                  | Invoke Serena's project indexing                                                                                                 | Python   |

## Important: Global vs Project CLAUDE.md

`home/.claude/CLAUDE.md` is the shared global agent instructions file. Home Manager links it into `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and `~/.pi/agent/AGENTS.md`. Likewise, `home/.claude/skills` is linked into Claude, Codex, and Pi via `nix/home/files.nix`. The root `CLAUDE.md` in this repo is project-specific instructions for working within this repo.

## Installing shared agent skills

Use `npx skills add ... -g --copy` when you want a third-party skill written into the shared global skills directory managed by this repo.

```bash
npx skills add https://github.com/googleworkspace/cli \
  --skill gws-gmail \
  -g -a claude-code --copy -y
```

Because `~/.claude/skills` is an out-of-store symlink back into `home/.claude/skills`, this updates the repo-managed files directly and the same skill becomes available to Codex and pi through their linked paths.

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
- a nix-darwin `launchd` agent in `nix/darwin/default.nix` that runs it every 60 seconds and logs to `/tmp/github-pr-task-sync.log`
- persistent state in `~/.local/share/github-pr-task-sync/state.json` so repeated polls do not recreate the same task for the same notification update

Tasks are created in the default Google Tasks list with title `PR: {title}` and the PR URL in the notes.

## Agent transcript archive

The dotfiles repo manages two commands for archiving local AI transcripts:

- `agent-transcripts-sync` copies raw Claude Code, Codex, and Pi transcript artifacts from `~/.claude`, `~/.codex`, and `~/.pi` into `~/Code/HerbCaudill/agent-transcripts`
- `install-agent-transcripts-cron` installs a managed cron block that runs `agent-transcripts-sync` every 15 minutes and logs to `/tmp/agent-transcripts-sync.log`

Codex does not currently expose a clean flat session transcript file on disk in this environment, so the archive preserves Codex's raw local stores directly: `history.jsonl`, `state_5.sqlite*`, and `logs_1.sqlite*`. Pi session transcripts are archived from `~/.pi/agent/sessions/**/*.jsonl`.
