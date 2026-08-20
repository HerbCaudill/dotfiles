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
  marvinRepository = "${homeDirectory}/Code/HerbCaudill/marvin";
  marvinRuntimeDirectory = "${homeDirectory}/Library/Application Support/Marvin";
  marvinConfigPath = "${marvinRuntimeDirectory}/config.json";
  marvinLogDirectory = "${homeDirectory}/Library/Logs/Marvin";
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
  marvinPath = "${userBin}:${homeDirectory}/Library/pnpm/bin:${launchdPath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
  marvinConfig = pkgs.writeText "marvin-config.json" (
    builtins.toJSON {
      schemaVersion = 1;
      repositoryRoot = marvinRepository;
      roots = [
        "${homeDirectory}/Code/DevResults"
        "${homeDirectory}/Code/HerbCaudill"
      ];
      collectionIntervalMs = 60000;
      port = 43127;
    }
  );
  marvinDigest = pkgs.writeShellScript "marvin-digest" ''
    set -eu

    if [[ ! -r "${homeDirectory}/.secrets" ]]; then
      echo "Marvin digest credentials are unavailable" >&2
      exit 1
    fi
    source "${homeDirectory}/.secrets"
    if [[ -z "''${OPENAI_API_KEY:-}" ]]; then
      echo "Marvin digest credentials are unavailable" >&2
      exit 1
    fi

    exec ${pkgs.coreutils}/bin/env -i \
      HOME="${homeDirectory}" \
      LANG="en_US.UTF-8" \
      LOGNAME="${username}" \
      OPENAI_API_KEY="$OPENAI_API_KEY" \
      PATH="${marvinPath}" \
      USER="${username}" \
      ${pkgs.pnpm}/bin/pnpm digest -- \
        --config "${marvinConfigPath}" \
        --model gpt-5.6-luna \
        --collection-timeout-ms 180000 \
        --operation-timeout-ms 60000
  '';
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

  system.activationScripts.postActivation.text = ''
    ${pkgs.coreutils}/bin/install -d -m 0700 -o ${username} -g staff "${marvinRuntimeDirectory}"
    ${pkgs.coreutils}/bin/install -d -m 0700 -o ${username} -g staff "${marvinLogDirectory}"
    ${pkgs.coreutils}/bin/install -m 0600 -o ${username} -g staff ${marvinConfig} "${marvinConfigPath}.new"
    ${pkgs.coreutils}/bin/mv -f "${marvinConfigPath}.new" "${marvinConfigPath}"
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

  launchd.agents."marvin-digest" = {
    serviceConfig = {
      Label = "com.herbcaudill.marvin-digest";
      ProgramArguments = [ "${marvinDigest}" ];
      WorkingDirectory = marvinRepository;
      RunAtLoad = true;
      StartCalendarInterval = {
        Hour = 7;
        Minute = 0;
      };
      StandardOutPath = "${marvinLogDirectory}/digest.log";
      StandardErrorPath = "${marvinLogDirectory}/digest.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        PATH = marvinPath;
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
