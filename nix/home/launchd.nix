{ username, ... }:
let
  homeDirectory = "/Users/${username}";
  userBin = "${homeDirectory}/.local/bin";
  userProfileBin = "/etc/profiles/per-user/${username}/bin";
  automationPath = "${userBin}:${homeDirectory}/Library/pnpm/bin:${userProfileBin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
in
{
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
