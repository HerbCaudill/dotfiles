{
  config,
  lib,
  dotfilesRoot,
  pkgs,
  username,
  ...
}:
let
  homeDirectory = "/Users/${username}";
  userBin = "${homeDirectory}/.local/bin";
  tasksAgent = config.home-manager.users.${username}.services.tasksAgent;
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
  imports = [ ./localhost-router.nix ./devlocal-mini.nix ];

  nix.enable = false;
  nixpkgs.config.allowUnfree = true;

  users.users.${username} = {
    home = homeDirectory;
    shell = pkgs.zsh;
    # Lets agents on the mini PC reach this Mac with `ssh mac` over Tailscale.
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIRkImMojhrLcv17tQ5kRa6M+sduN8+Sk7LzbTdGCk+F herb@mini"
    ];
  };

  # Remote Login, limited to Herb's account with key authentication only.
  services.openssh = {
    enable = true;
    extraConfig = ''
      AllowUsers ${username}
      PasswordAuthentication no
      KbdInteractiveAuthentication no
    '';
  };

  programs.zsh.enable = true;
  environment.shells = [ pkgs.zsh ];
  fonts.packages = [ pkgs.ibm-plex ];
  system.primaryUser = username;

  # GUI apps stay on Homebrew casks, which install into /Applications and update
  # themselves; command-line tools come from Nix in nix/home/packages.nix.
  homebrew = {
    enable = true;
    onActivation.cleanup = "none";
    taps = [
      "anomalyco/tap"
      "minghinmatthewlam/tap"
    ];
    casks = [
      "1password-cli"
      "adobe-creative-cloud"
      "alt-tab"
      "amethyst"
      "anomalyco/tap/hex"
      "discord"
      "iterm2"
      "macfuse"
      "minghinmatthewlam/tap/pi-gui"
      "nordvpn"
      "notion"
      "obsidian"
      "opera"
      "rar"
      "raycast"
      "scansnap-home"
      "shottr"
      "signal"
      "slack"
      "spotify"
      "typora"
    ];
  };

  security.pam.services.sudo_local.enable = false;

  system.activationScripts.postActivation.text = ''
    # Never sleep on the power adapter so the mini can always reach this Mac.
    # nix-darwin's power.sleep.computer would also apply on battery.
    /usr/bin/pmset -c sleep 0
  '';

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

  launchd.agents."meeting-notes" = {
    serviceConfig = {
      Label = "com.herbcaudill.meeting-notes";
      ProgramArguments = [
        "${pkgs.pnpm}/bin/pnpm"
        "sync"
      ];
      WorkingDirectory = "${homeDirectory}/Code/HerbCaudill/zoom-transcripts";
      StartInterval = 900;
      StandardOutPath = "/tmp/meeting-notes.log";
      StandardErrorPath = "/tmp/meeting-notes.log";
      EnvironmentVariables = {
        # pi lives in the pnpm global bin, which is not part of launchdPath.
        PATH = "${homeDirectory}/Library/pnpm/bin:${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
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
      ProgramArguments = [ "${pkgs.nodejs_24}/bin/node" "${userBin}/github-pr-task-sync" ];
      StartInterval = 60;
      StandardOutPath = "/tmp/github-pr-task-sync.log";
      StandardErrorPath = "/tmp/github-pr-task-sync.log";
      EnvironmentVariables = {
        TASKS_SPACE_ID = tasksAgent.spaceId;
        TASKS_FRESHNESS = "converged";
        PATH = "${userBin}:/etc/profiles/per-user/${username}/bin:${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
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
