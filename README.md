# dotfiles

Personal macOS environment managed with **Nix**, **nix-darwin**, and **home-manager**.

## Apply the configuration

```bash
nix run github:LnL7/nix-darwin/master#darwin-rebuild -- \
  switch --flake ~/Code/HerbCaudill/dotfiles#herbcaudill
```

## Layout

- `flake.nix` — top-level Nix entry point
- `nix/darwin/` — machine-level macOS configuration, including launchd agents
- `nix/home/` — user-level shell, git, packages, and file mappings
- `home/` — repo-owned source assets that Home Manager links into `~/`
- `scripts/` — repo automation that is still owned by this repo

## Transitional note

Some pre-Nix files still exist under `home/` as reference material (`.zshrc`, `.gitconfig`, old LaunchAgent plists, etc.), but they are no longer applied. The active configuration now lives under `nix/`.

## Notes

- The old symlink installer has been removed; `scripts/symlink.mjs` now fails loudly.
- `home/.claude`, `home/.local/bin`, and related repo-owned assets are linked with out-of-store symlinks so edits in this repo take effect directly.
- LaunchAgents now live in `nix/darwin/default.nix`, not in `home/Library/LaunchAgents/`.
