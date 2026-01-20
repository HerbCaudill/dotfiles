# dotfiles

Personal configuration files.

## Install

```bash
./install.js
```

Symlinks files from `home/` to `~/`. Paths listed in `symlink-dirs.conf` are linked as directories; all others are linked as individual files.

## Contents

- **Git**: `.gitconfig`, `.gitignore_global`
- **Zsh**: `.zshrc`, `.oh-my-zsh/custom/themes/herb.zsh-theme`
- **Claude**: `.claude/CLAUDE.md`, `.claude/settings.json`, `.claude/skills/`, `.claude/statusline.ts`
- **Codex**: `.claude/CLAUDE.md` is symlinked to `~/.codex/AGENTS.md`; `.claude/skills/` is symlinked to `~/.codex/skills`
- **Tools**: `.prettierrc`, `.asdfrc`
