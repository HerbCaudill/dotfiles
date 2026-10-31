{ config, pkgs, ... }:
{
  launchd.agents.claude-chat-sync = {
    enable = true;
    config = {
      Label = "com.herbcaudill.claude-chat-sync";
      ProgramArguments = [
        "${pkgs.nodejs_24}/bin/node"
        "--experimental-strip-types"
        "${config.home.homeDirectory}/Code/HerbCaudill/dotfiles/scripts/claude-chats/runClaudeChatSync.ts"
      ];
      StartCalendarInterval = { Hour = 3; Minute = 0; };
      StandardOutPath = "/tmp/claude-chat-sync.log";
      StandardErrorPath = "/tmp/claude-chat-sync.log";
      EnvironmentVariables = {
        HOME = config.home.homeDirectory;
        LANG = "en_US.UTF-8";
        TZ = "Europe/Madrid";
        PATH = "${pkgs.nodejs_24}/bin:${config.home.homeDirectory}/.local/bin:${config.home.homeDirectory}/Library/pnpm/bin:/etc/profiles/per-user/${config.home.username}/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
      };
    };
  };
}
