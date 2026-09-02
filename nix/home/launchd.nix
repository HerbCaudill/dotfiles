{ username, ... }:
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
      };
    };
  };

  launchd.agents."resurface-tickler-tasks" = {
    enable = true;
    config = {
      Label = "com.herbcaudill.resurface-tickler-tasks";
      ProgramArguments = [ "${userBin}/resurface-tickler-tasks" ];
      StartCalendarInterval = {
        Hour = 6;
        Minute = 0;
      };
      StandardOutPath = "/tmp/resurface-tickler-tasks.log";
      StandardErrorPath = "/tmp/resurface-tickler-tasks.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        LANG = "en_US.UTF-8";
        PATH = automationPath;
      };
    };
  };
}
