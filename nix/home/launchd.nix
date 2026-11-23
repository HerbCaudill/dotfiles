{
  config,
  lib,
  pkgs,
  username,
  dotfilesRoot,
  ...
}:
let
  homeDirectory = "/Users/${username}";
  userBin = "${homeDirectory}/.local/bin";
  userProfileBin = "/etc/profiles/per-user/${username}/bin";
  morningBriefingLauncher = "${homeDirectory}/.local/libexec/morning-briefing-launcher";
  automationPath = "${userBin}:${homeDirectory}/Library/pnpm/bin:${userProfileBin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
in
{
  launchd.agents."personal-files-sync" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.personal-files-sync";
      ProgramArguments = [
        "${pkgs.nodejs_24}/bin/node"
        "${userBin}/personal-info-sync"
        "mini"
      ];
      WatchPaths = [
        "${dotfilesRoot}/home/.claude/skills/personal-info"
        "${dotfilesRoot}/home/.claude/skills/personal-info/personal-info.md"
        "${dotfilesRoot}/home/.claude/skills/personal-info/low-stakes-passwords.json"
      ];
      RunAtLoad = true;
      StartInterval = 300;
      ThrottleInterval = 10;
      StandardOutPath = "/tmp/personal-files-sync.log";
      StandardErrorPath = "/tmp/personal-files-sync.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        PATH = automationPath;
      };
    };
  };

  # bd treats the shared server as external and doesn't restart it, so without
  # this every repo's beads are down after a reboot until someone runs
  # `bd dolt start`.
  launchd.agents."beads-shared-server" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.beads-shared-server";
      ProgramArguments = [
        "${pkgs.dolt}/bin/dolt"
        "sql-server"
        "--config"
        "${homeDirectory}/.beads/shared-server/dolt-server-config.yaml"
      ];
      WorkingDirectory = "${homeDirectory}/.beads/shared-server/dolt";
      RunAtLoad = true;
      KeepAlive = true;
      ThrottleInterval = 10;
      StandardOutPath = "${homeDirectory}/.beads/shared-server/dolt-server.log";
      StandardErrorPath = "${homeDirectory}/.beads/shared-server/dolt-server.log";
    };
  };

  # devresults-next runs Postgres and Azurite in Docker Compose; this starts
  # Colima's Docker VM at login. Rosetta runs the amd64-only PostGIS image.
  launchd.agents."colima" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.colima";
      ProgramArguments = [
        "${pkgs.colima}/bin/colima"
        "start"
        "--vm-type"
        "vz"
        "--vz-rosetta"
        "--cpu"
        "6"
        "--memory"
        "12"
        "--disk"
        "100"
      ];
      RunAtLoad = true;
      StandardOutPath = "/tmp/colima.log";
      StandardErrorPath = "/tmp/colima.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        PATH = automationPath;
      };
    };
  };

  launchd.agents."watch-beads" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.watch-beads";
      ProgramArguments = [ "${pkgs.nodejs_24}/bin/node" "${userBin}/watch-beads" "_daemon" ];
      RunAtLoad = true;
      KeepAlive = true;
      ThrottleInterval = 10;
      StandardOutPath = "/tmp/watch-beads.log";
      StandardErrorPath = "/tmp/watch-beads.log";
      EnvironmentVariables = {
        PATH = "${homeDirectory}/.t3/bin:${userBin}:${homeDirectory}/Library/pnpm:${userProfileBin}:${lib.makeBinPath [ pkgs.nodejs_24 pkgs.dolt ]}:/usr/bin:/bin:/usr/sbin:/sbin";
      };
    };
  };

  # Chrome shows Codex's debugger warning in every tab. Start the first Chrome
  # process with this flag so Raycast searches and web app launchers reuse it.
  launchd.agents."chrome-silent-debugging" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.chrome-silent-debugging";
      ProgramArguments = [
        "/usr/bin/open"
        "-gj"
        "-a"
        "Google Chrome"
        "--args"
        "--silent-debugger-extension-api"
      ];
      RunAtLoad = true;
    };
  };

  launchd.agents."process-inbox" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.process-inbox";
      ProgramArguments = [ morningBriefingLauncher "--mac-sources" ];
      StartInterval = 3600;
      StandardOutPath = "/tmp/inbox-processing.log";
      StandardErrorPath = "/tmp/inbox-processing.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        LANG = "en_US.UTF-8";
        PATH = automationPath;
        TASKS_SPACE_ID = config.services.tasksAgent.spaceId;
        TASKS_FRESHNESS = "converged";
      };
    };
  };

  launchd.agents."dream" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.dream";
      ProgramArguments = [
        "${pkgs.nodejs_24}/bin/node"
        "${homeDirectory}/Code/HerbCaudill/dreams/scripts/runDream.ts"
      ];
      WorkingDirectory = "${homeDirectory}/Code/HerbCaudill/dreams";
      StartCalendarInterval = {
        Hour = 2;
        Minute = 0;
      };
      StandardOutPath = "/tmp/dream.log";
      StandardErrorPath = "/tmp/dream.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        LANG = "en_US.UTF-8";
        PATH = automationPath;
        TZ = "Europe/Madrid";
      };
    };
  };

  launchd.agents."morning-briefing" = {
    enable = false;
    config = {
      Label = "com.herbcaudill.morning-briefing";
      ProgramArguments = [ morningBriefingLauncher ];
      StartCalendarInterval = {
        Hour = 7;
        Minute = 0;
      };
      StandardOutPath = "/tmp/morning-briefing.log";
      StandardErrorPath = "/tmp/morning-briefing.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        LANG = "en_US.UTF-8";
        PATH = automationPath;
        TASKS_SPACE_ID = config.services.tasksAgent.spaceId;
        TASKS_FRESHNESS = "converged";
      };
    };
  };

  # Build the launcher outside the Nix store and only when its source changes, so its code
  # signature, and the Full Disk Access granted to it, survive rebuilds and Nix updates.
  home.activation.morningBriefingLauncher = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    source=${./../../scripts/morning-briefing/launcher.c}
    target=${lib.escapeShellArg morningBriefingLauncher}
    stamp="$target.source"
    if [ ! -x "$target" ] || [ "$(cat "$stamp" 2>/dev/null)" != "$source" ]; then
      run mkdir -p "$(dirname "$target")"
      run /usr/bin/clang -O2 -o "$target" "$source"
      run /usr/bin/codesign --force --sign - --identifier com.herbcaudill.morning-briefing-launcher "$target"
      run sh -c 'echo "$1" > "$2"' _ "$source" "$stamp"
      echo "Rebuilt $target; grant it Full Disk Access in System Settings › Privacy & Security."
    fi
  '';
}
