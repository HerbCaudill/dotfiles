# dotfiles

Personal configuration files.

## Install

```bash
./scripts/symlink.mjs
```

Symlinks files from `home/` to `~/`. Paths listed in `.symlinks` are linked as directories (`.claude/skills`, `.claude/agents`); all others are linked as individual files. This repo now also manages pi's global settings at `home/.pi/agent/settings.json` → `~/.pi/agent/settings.json`. It also creates shared agent symlinks for Codex and pi (`~/.codex/AGENTS.md` and `~/.pi/agent/AGENTS.md` → `.claude/CLAUDE.md`, `~/.codex/skills` and `~/.pi/agent/skills` → `.claude/skills`).

Because `~/.claude/skills` points at `home/.claude/skills`, running `npx skills add ... -g --copy` installs third-party skills into this repo and shares them with Claude Code, Codex, and pi.

## Installing agent skills

```bash
npx skills add https://github.com/googleworkspace/cli \
  --skill gws-gmail \
  -g -a claude-code --copy -y
```

Use the same pattern for other skill names from a repository.

## Contents

- **Git**: `.gitconfig`, `.gitignore`
- **Zsh**: `.zshrc`, `.oh-my-zsh/custom/themes/herb.zsh-theme`
- **Claude / shared agent config**: `.claude/CLAUDE.md`, `.claude/settings.json`, `.claude/skills/`, `.claude/agents/`, `.claude/statusline.js` (also symlinked into Codex and pi)
- **Pi**: `.pi/agent/settings.json`
- **Tools**: `.prettierrc`, `.asdfrc`
- **Bin scripts** (`~/.local/bin/`):
  - Worktree helpers: `wt`, `wtt`, `wtcd`, `wtls`, `wtrm`, `wtclean`, `wtclone`
  - Sprite/OpenClaw: `sprite`, `spc`, `spoc`, `spoc-pair`, `_sp_setup.mjs`
  - Other: `agent-transcripts-sync`, `install-agent-transcripts-cron`, `github-pr-task-sync`, `bd`/`beads`, `claude`, `serena`, `serena-mcp-server`, `index-project`
- **Scripts** (`scripts/`):
  - `symlink.mjs` - symlink installer
  - `setup-sprite.ts`, `setup-openclaw.ts` - sprite provisioning
  - `github-pr-tasks/` - GitHub notification to Google Tasks sync
  - `raycast/` - Raycast script commands

## GitHub PR task sync

`github-pr-task-sync` polls GitHub notifications every minute via the `com.herbcaudill.github-pr-task-sync` LaunchAgent. When a pull request is assigned to Herb or Herb is requested as a reviewer, it creates a Google Task in the default task list with title `PR: {title}` and the PR link in the notes.

The sync stores state in `~/.local/share/github-pr-task-sync/state.json` so the same notification update is only processed once per poll, but later updates to the same PR can create additional tasks.

## Agent transcript archive

`agent-transcripts-sync` copies raw local Claude Code, Codex, and Pi transcript artifacts into `~/Code/HerbCaudill/agent-transcripts` and commits changes there.

`install-agent-transcripts-cron` installs a managed crontab entry that runs the sync every 15 minutes and writes logs to `/tmp/agent-transcripts-sync.log`.
