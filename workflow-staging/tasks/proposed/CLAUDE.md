This repo manages global configuration files with **Nix**, using `nix-darwin` for macOS system state and `home-manager` for user-level config.

## Important: Global vs Project CLAUDE.md

`home/.claude/CLAUDE.md` is the shared global agent instructions file. Home Manager links it into `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and `~/.pi/agent/AGENTS.md`. Likewise, `home/.claude/skills` is linked into Claude, Codex, and Pi via `nix/home/files.nix`. Only selected durable Claude config files are linked; runtime state such as transcripts, cache, telemetry, and backups should stay outside the repo. The root `CLAUDE.md` in this repo is project-specific instructions for working within this repo.

> [!NOTE] `AGENTS.md` is a symlink to `CLAUDE.md`.

## Key commands

```bash
# Apply the full macOS + home configuration. (Requires root. Run this after any changes to the configuration.)
pnpm nix:rebuild

# Run unit tests for repo-managed automation scripts
pnpm test

# Format the repo
pnpm format
```

Agents may run `pnpm nix:rebuild` themselves after changes that need the live macOS or Home Manager configuration to take effect. Run it in an interactive terminal/PTY so `sudo` can prompt the user for Touch ID or a password; do not ask the user to run it manually just to handle sudo.

## Structure

- `flake.nix` — top-level flake
- `nix/darwin/` — nix-darwin modules
- `nix/home/` — home-manager modules
- `home/` — source assets linked into `~/`
  - `.claude/` — durable Claude config, skills, and agents
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

| Command                   | Description                                                                                                                                        | Language |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `agent-transcripts-sync`  | Sync raw local Claude Code, Codex, and Pi transcript stores into `~/Code/HerbCaudill/agent-transcripts` and commit changes there                   | Node.js  |
| `drsync`                  | Save the current macOS DevResults clone to a WIP branch, sync the Windows VM checkout, and run a Windows-side command                              | Node.js  |
| `github-pr-task-sync`     | Poll GitHub notifications and capture assigned/review-requested PRs in Tasks Inbox                                                                 | Node.js  |
| `gws-delegated`           | Run GWS commands with a short-lived domain-wide delegated token for Herb                                                                           | Node.js  |
| `update-agent-harnesses`  | Update Claude Code, Pi, Codex, pnpm, and bd                                                                                                        | Zsh      |
| `beads`                   | Wrapper for `bd`                                                                                                                                   | Shell    |
| `gh-sync`                 | Sync `~/Code/HerbCaudill` with all repos on github.com/HerbCaudill                                                                                 | Bash     |
| `serena`                  | Invoke Serena CLI                                                                                                                                  | Python   |
| `serena-mcp-server`       | Start the Serena MCP server                                                                                                                        | Python   |
| `index-project`           | Invoke Serena's project indexing                                                                                                                   | Python   |
| `morning-briefing`        | Run the repo-owned multi-agent briefing pipeline, save it to the daily note, and create a pinned Codex task                                        | Node.js  |
| `resurface-tickler-tasks` | Historical Google Tasks helper; no longer scheduled or used for Tasks Snoozed                                                                      | Node.js  |
| `tslsp`                   | Type-aware TypeScript code intelligence via tsgo; self-installs into `~/.local/share/tslsp` with npm (pnpm's global layout breaks its tsgo lookup) | Bash     |

## Windows Parallels Claude setup

A LaunchAgent in `nix/darwin/default.nix` watches `home/.claude` and runs `scripts/windows/install-claude-shared-config-from-mac.sh` when repo-managed Claude config changes. The macOS wrapper uses `prlctl` to run the PowerShell installer against `C:\Users\herbcaudill\.claude`, linking native Windows Claude to the repo-managed global instructions, agents, skills, and status line through the Parallels `\\Mac\Home\Code\HerbCaudill\dotfiles` shared folder. If running from inside Windows, use `scripts/windows/install-claude-shared-config.ps1`; use its `-Copy` flag only when Windows cannot create symlinks.

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
```

## GitHub PR task sync

The existing `github-pr-task-sync` LaunchAgent runs every 60 seconds through the managed Tasks CLI and logs counts or fixed failure summaries to `/tmp/github-pr-task-sync.log`. Assigned and review-requested PR notifications become Tasks Inbox captures titled `PR: {title}`, with the original PR URL saved in the description as a separate, replay-safe operation.

The checkpoint stays at `~/.local/share/github-pr-task-sync/state.json`. It preserves historical event keys, successful task IDs, and original request inputs. Each notification update has stable capture and description request IDs; an unfinished batch retains the previous polling cursor. Conflicting descriptions and unavailable or unconfirmed outcomes keep the event unfinished for inspection. Retrying a successful receipt preserves later human title, completion, and description edits.

The selected Tasks space and required `converged` freshness come from the managed launch environment. The workflow does not substitute Google Tasks or treat outbound upload as inbound freshness. See `workflow-staging/tasks/README.md` for the reviewed cutover evidence and checkpoint recovery boundaries.

## Agent harness updates

The dotfiles repo manages automated harness updates with:

- `update-agent-harnesses`, a Zsh script that updates pnpm, Codex, Pi, Claude Code, and bd directly
- a nix-darwin `launchd` agent in `nix/darwin/default.nix` that runs it at 9:20, 15:20, and 21:20 and logs to `/tmp/update-agent-harnesses.log`

## Morning workflow automation

Home Manager owns two morning workflow LaunchAgents in `nix/home/launchd.nix`:

- `process-inbox` runs hourly. Its wrapper invokes the reviewed Briefings inbox pipeline, preserving captures and journals until the Tasks destination is confirmed. Research context stays in canonical Obsidian notes with typed Tasks backlinks. Uncertain historical completion markers require review. Logs remain `/tmp/inbox-processing.log` and `/tmp/inbox-research.log`.
- `morning-briefing` runs daily at 07:00. The Briefings entrypoint processes inbox captures, gathers sources through parallel agents, persists private run evidence, verifies the daily note, waits for Obsidian Sync, and creates a pinned Codex session. After presenting the exact briefing, the session invokes task-review once with `views: ["inbox"]`. Output remains `/tmp/morning-briefing.log`.

Both existing jobs use the enrolled Tasks space and explicit convergence requirement. Missing or unavailable data remains actionable. The old `resurface-tickler-tasks` job is retired: Snoozed visibility follows the observed Europe/Madrid date, so reaching a hidden-until date requires no scheduled write. Generic Google tools remain available for explicitly requested historical access.

## Agent transcript archive

The dotfiles repo manages transcript archiving with:

- `agent-transcripts-sync`, which copies raw Claude Code, Codex, and Pi transcript artifacts from `~/.claude`, `~/.codex`, and `~/.pi` into `~/Code/HerbCaudill/agent-transcripts`
- a nix-darwin `launchd` agent in `nix/darwin/default.nix` that runs `agent-transcripts-sync` every 15 minutes and logs to `/tmp/agent-transcripts-sync.log`

Codex does not currently expose a clean flat session transcript file on disk in this environment, so the archive preserves Codex's raw local stores directly: `history.jsonl`, `state_5.sqlite*`, and `logs_1.sqlite*`. Pi session transcripts are archived from `~/.pi/agent/sessions/**/*.jsonl`.

## Lightweight workflow for trivial dotfile edits

For trivial, localized edits such as adding a shell alias, changing a small config value, or fixing a typo:

- edit the relevant file directly
- do not use planning or brainstorming workflows
- do not run repo-wide tests or formatters unless they are relevant to the touched file
- run `pnpm nix:rebuild` only when the change needs to take effect immediately
- do not update `README.md` or instruction files unless the change affects durable guidance
- prefer the smallest possible verification step, if any

- `flake.nix` is the top-level entry point for the environment
- `nix/darwin/default.nix` owns machine-level macOS configuration such as launchd agents
- `nix/home/` owns user-level config such as zsh, git, packages, and file mappings
- `home/` stores repo-owned source assets like Claude skills, custom scripts, and JSON/YAML config files
- Home Manager uses out-of-store symlinks for live repo-owned assets, so edits in this repo show up directly in `~/`
- Extra harness links are declared in `nix/home/files.nix` (`~/.codex/AGENTS.md`, `~/.pi/agent/AGENTS.md`, skills links, etc.)
