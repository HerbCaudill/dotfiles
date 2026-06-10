{
  lib,
  dotfilesRoot,
  pkgs,
  username,
  ...
}:
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
in
{
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
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
    };
  };

  launchd.agents."briefing" = {
    serviceConfig = {
      Label = "com.herbcaudill.briefing";
      ProgramArguments = [
        "${pkgs.pnpm}/bin/pnpm"
        "briefing"
      ];
      WorkingDirectory = "${homeDirectory}/Code/HerbCaudill/briefings";
      StartCalendarInterval = {
        Hour = 5;
        Minute = 0;
      };
      StandardOutPath = "/tmp/briefing.log";
      StandardErrorPath = "/tmp/briefing.log";
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
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

  launchd.agents."windows-claude-config-sync" = {
    serviceConfig = {
      Label = "com.herbcaudill.windows-claude-config-sync";
      ProgramArguments = [ "${dotfilesRoot}/scripts/windows/install-claude-shared-config-from-mac.sh" ];
      WatchPaths = [ "${dotfilesRoot}/home/.claude" ];
      StandardOutPath = "/tmp/windows-claude-config-sync.log";
      StandardErrorPath = "/tmp/windows-claude-config-sync.log";
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
    };
  };

  launchd.agents."update-agent-harnesses" = {
    serviceConfig = {
      Label = "com.herbcaudill.update-agent-harnesses";
      ProgramArguments = [ "${userBin}/update-agent-harnesses" ];
      StartCalendarInterval = [
        {
          Hour = 9;
          Minute = 20;
        }
        {
          Hour = 15;
          Minute = 20;
        }
        {
          Hour = 21;
          Minute = 20;
        }
      ];
      StandardOutPath = "/tmp/update-agent-harnesses.log";
      StandardErrorPath = "/tmp/update-agent-harnesses.log";
      EnvironmentVariables = {
        PATH = "${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
      };
    };
  };

  system.stateVersion = 6;
}
