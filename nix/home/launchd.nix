{
  config,
  pkgs,
  username,
  ...
}:
let
  homeDirectory = "/Users/${username}";
  userBin = "${homeDirectory}/.local/bin";
  userProfileBin = "/etc/profiles/per-user/${username}/bin";
  automationPath = "${userBin}:${homeDirectory}/Library/pnpm/bin:${userProfileBin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
in
{
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
      ProgramArguments = [ "${userBin}/process-inbox" ];
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
    enable = true;
    config = {
      Label = "com.herbcaudill.morning-briefing";
      ProgramArguments = [ "${userBin}/morning-briefing" ];
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

}
