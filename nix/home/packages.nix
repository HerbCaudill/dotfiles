{ pkgs, ... }:
{
  home.packages = with pkgs; [
    bat
    coreutils
    curl
    dolt
    expect
    fd
    findutils
    fzf
    gawk
    gh
    git
    gnugrep
    gnused
    google-cloud-sdk
    jq
    nixfmt
    nodejs_24
    openssh
    pnpm
    python313
    ripgrep
    tree
    uv
    watchman
    yarn
    # bd itself is installed by update-agent-harnesses into ~/.local/bin, which
    # precedes the Nix profile on PATH. nixpkgs' beads is far behind upstream and
    # having a second bd on PATH risks an older binary touching the Dolt databases.
    (writeShellScriptBin "beads" ''
      exec "$HOME/.local/bin/bd" "$@"
    '')
  ];
}
