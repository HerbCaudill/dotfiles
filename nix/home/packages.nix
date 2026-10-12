{ pkgs, ... }:
{
  home.packages = with pkgs; [
    azure-cli
    bat
    coreutils
    curl
    dolt
    duti
    exiftool
    expect
    fd
    ffmpeg
    findutils
    flyctl
    fzf
    gawk
    gh
    git
    git-filter-repo
    git-lfs
    gnugrep
    gnused
    go
    google-cloud-sdk
    gzip
    imagemagick
    jq
    just
    lego
    mkcert
    nixfmt
    nodejs_24
    openssh
    pandoc
    pnpm
    poppler-utils
    python313
    qpdf
    ripgrep
    rsync
    # Reads Signal Desktop's encrypted database for the morning briefing.
    sigtop
    sqlcmd
    sshpass
    tree
    unzip
    uv
    watchman
    whisper-cpp
    yarn
    # bd itself is installed by update-agent-harnesses into ~/.local/bin, which
    # precedes the Nix profile on PATH. nixpkgs' beads is far behind upstream and
    # having a second bd on PATH risks an older binary touching the Dolt databases.
    (writeShellScriptBin "beads" ''
      exec "$HOME/.local/bin/bd" "$@"
    '')
  ];
}
