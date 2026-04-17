{ pkgs, ... }:
{
  home.packages = with pkgs; [
    bat
    beads
    coreutils
    curl
    dolt
    expect
    fd
    findutils
    flyctl
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
    sshfs-fuse
    tree
    uv
    watchman
    yarn
    (writeShellScriptBin "beads" ''
      exec ${beads}/bin/bd "$@"
    '')
  ];
}
