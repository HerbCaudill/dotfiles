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
  nix.settings.experimental-features = "nix-command flakes";
  nixpkgs.config.allowUnfree = true;

  services.nix-daemon.enable = true;

  users.users.${username} = {
    home = homeDirectory;
    shell = pkgs.zsh;
  };

  programs.zsh.enable = true;
  environment.shells = [ pkgs.zsh ];
  system.primaryUser = username;

  launchd.agents."beads-shared-server" = {
    serviceConfig = {
      Label = "com.herbcaudill.beads-shared-server";
      ProgramArguments = [
        "/bin/sh"
        "-lc"
        ''mkdir -p "$HOME/.beads/shared-server/dolt" && cd "$HOME/.beads/shared-server/dolt" && { [ -d .dolt ] || ${pkgs.dolt}/bin/dolt init; } && exec ${pkgs.dolt}/bin/dolt sql-server -H 127.0.0.1 -P 3308''
      ];
      RunAtLoad = true;
      KeepAlive = true;
      StandardOutPath = "/tmp/beads-shared-server.log";
      StandardErrorPath = "/tmp/beads-shared-server.log";
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
    };
  };

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
