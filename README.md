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

## Personal DevResults environments

Home Manager installs `drenv`, the Mac command for paired native Mac/Windows DevResults worktrees with owned SQL data, Azurite state and IIS runtimes. Start with `drenv --help` and the [user guide](scripts/devresults-environments/USAGE.md). Creation needs a verified coordinated SQL/blob snapshot and sufficient Windows disk capacity; [installation evidence](scripts/devresults-environments/INSTALLATION-EVIDENCE.md) records the live checks and remaining proof.

## Notes

- Selected files in `home/.claude`, `home/.local/bin`, and related repo-owned assets are linked into `~/` with out-of-store Home Manager symlinks, so edits in this repo take effect directly while Claude runtime state stays outside the repo.
- `nix/darwin/default.nix` installs a LaunchAgent that watches `home/.claude` and runs `scripts/windows/install-claude-shared-config-from-mac.sh` when the repo-managed Claude config changes. If you are already inside Windows, run `scripts/windows/install-claude-shared-config.ps1` instead.
- LaunchAgents live in `nix/darwin/default.nix`.
- The Marvin digest LaunchAgent runs at login and at 07:00, scanning `~/Code/HerbCaudill` and `~/Code/DevResults`. Its private config and SQLite runtime live under `~/Library/Application Support/Marvin`; deterministic exports remain in `~/Code/HerbCaudill/marvin`; combined logs go to `~/Library/Logs/Marvin/digest.log`.
