{ lib, pkgs, username, ... }:
let
  homeDirectory = "/Users/${username}";
  userBin = "${homeDirectory}/.local/bin";
  launchdPath = lib.makeBinPath [
    pkgs.coreutils
    pkgs.dolt
    pkgs.findutils
    pkgs.gawk
    pkgs.gh
    pkgs.git
    pkgs.gnugrep
    pkgs.gnused
    pkgs.google-cloud-sdk
    pkgs.nodejs_24
    pkgs.openssh
    pkgs.pnpm
    pkgs.python313
    pkgs.uv
  ];
in {
  nix.enable = false;
  nixpkgs.config.allowUnfree = true;

  users.users.${username} = {
    home = homeDirectory;
    shell = pkgs.zsh;
  };

  programs.zsh.enable = true;
  environment.shells = [ pkgs.zsh ];
  system.primaryUser = username;

  security.pam.services.sudo_local.enable = false;

  launchd.agents."daily-note" = {
    serviceConfig = {
      Label = "com.herbcaudill.daily-note";
      ProgramArguments = [ "${userBin}/create-daily-note" ];
      StartCalendarInterval = {
        Hour = 23;
        Minute = 0;
      };
      StandardOutPath = "/tmp/daily-note.log";
      StandardErrorPath = "/tmp/daily-note.log";
    };
  };

  launchd.agents."agent-transcripts-sync" = {
    serviceConfig = {
      Label = "com.herbcaudill.agent-transcripts-sync";
      ProgramArguments = [ "${userBin}/agent-transcripts-sync" ];
      StartInterval = 900;
      StandardOutPath = "/tmp/agent-transcripts-sync.log";
      StandardErrorPath = "/tmp/agent-transcripts-sync.log";
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
    };
  };

  launchd.agents."gh-sync" = {
    serviceConfig = {
      Label = "com.herbcaudill.gh-sync";
      ProgramArguments = [ "${userBin}/gh-sync" ];
      StartInterval = 900;
      StandardOutPath = "/tmp/gh-sync.log";
      StandardErrorPath = "/tmp/gh-sync.log";
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
    };
  };

  launchd.agents."github-pr-task-sync" = {
    serviceConfig = {
      Label = "com.herbcaudill.github-pr-task-sync";
      ProgramArguments = [ "${userBin}/github-pr-task-sync" ];
      StartInterval = 60;
      StandardOutPath = "/tmp/github-pr-task-sync.log";
      StandardErrorPath = "/tmp/github-pr-task-sync.log";
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
    };
  };

  launchd.agents."obsidian-sync" = {
    serviceConfig = {
      Label = "com.herbcaudill.obsidian-sync";
      ProgramArguments = [ "${userBin}/obsidian-sync" ];
      StartInterval = 300;
      StandardOutPath = "/tmp/obsidian-sync.log";
      StandardErrorPath = "/tmp/obsidian-sync.log";
    };
  };

  system.stateVersion = 6;
}
