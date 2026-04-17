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
    (writeShellScriptBin "beads" ''
      exec ${beads}/bin/bd "$@"
    '')
  ];
}
