{ username, ... }:
{
  imports = [
    ./codex.nix
    ./files.nix
    ./git.nix
    ./launchd.nix
    ./packages.nix
    ./zsh.nix
  ];

  home.username = username;
  home.homeDirectory = "/Users/${username}";
  home.stateVersion = "25.05";

  programs.home-manager.enable = true;
}
