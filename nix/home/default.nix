{ username, ... }:
{
  imports = [
    ./codex.nix
    ./files.nix
    ./git.nix
    ./launchd.nix
    ./packages.nix
    ./tasks-agent.nix
    ./zsh.nix
  ];

  home.username = username;
  home.homeDirectory = "/Users/${username}";
  home.stateVersion = "25.05";

  services.tasksAgent = {
    enable = true;
    spaceId = "B7CSO2L6KYNN4HZBSBNHP3LC3SA7PYNJO";
    autoStart = false;
  };

  programs.home-manager.enable = true;
}
