{ username, ... }:
{
  imports = [
    ./files.nix
    ./git.nix
    ./packages.nix
    ./zsh.nix
  ];

  home.username = username;
  home.homeDirectory = "/Users/${username}";
  home.stateVersion = "25.05";

  programs.home-manager.enable = true;
}
