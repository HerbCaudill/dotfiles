# dotfiles

Personal configuration files.

## Install

```bash
./scripts/symlink.mjs
```

Symlinks files from `home/` to `~/`. Paths listed in `.symlinks` are linked as directories (`.claude/skills`, `.claude/agents`); all others are linked as individual files. Also creates Codex symlinks (`~/.codex/AGENTS.md` → `CLAUDE.md`, `~/.codex/skills` → `.claude/skills`).

## Contents

- **Git**: `.gitconfig`, `.gitignore`
- **Zsh**: `.zshrc`, `.oh-my-zsh/custom/themes/herb.zsh-theme`
- **Claude**: `.claude/CLAUDE.md`, `.claude/settings.json`, `.claude/skills/`, `.claude/agents/`, `.claude/statusline.js`
- **Tools**: `.prettierrc`, `.asdfrc`
- **Bin scripts** (`~/.local/bin/`):
  - Worktree helpers: `wt`, `wtt`, `wtcd`, `wtls`, `wtrm`, `wtclean`, `wtclone`
  - Sprite/OpenClaw: `sprite`, `spc`, `spoc`, `spoc-pair`, `_sp_setup.mjs`
  - Other: `agent-transcripts-sync`, `install-agent-transcripts-cron`, `bd`/`beads`, `claude`, `serena`, `serena-mcp-server`, `index-project`
- **Scripts** (`scripts/`):
  - `symlink.mjs` - symlink installer
  - `setup-sprite.ts`, `setup-openclaw.ts` - sprite provisioning
  - `raycast/` - Raycast script commands

## Agent transcript archive

`agent-transcripts-sync` copies raw local Claude Code and Codex transcript artifacts into `~/Code/HerbCaudill/agent-transcripts` and commits changes there.

`install-agent-transcripts-cron` installs a managed crontab entry that runs the sync every 15 minutes and writes logs to `/tmp/agent-transcripts-sync.log`.
