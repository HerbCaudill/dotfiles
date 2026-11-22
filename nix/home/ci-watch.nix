{ config, pkgs, username, ... }:
let
  homeDirectory = config.home.homeDirectory;
  stateDirectory = "${homeDirectory}/.local/state/leo/ci-watch";
in
{
  # Leo's model-free watcher for red CI on devresults-next's main. See Leo's docs/ci-watch.md.
  launchd.agents.ci-watch = {
    enable = true;
    config = {
      Label = "com.herbcaudill.ci-watch";
      ProgramArguments = [
        "${pkgs.nodejs_24}/bin/node"
        "--no-warnings"
        "${homeDirectory}/Code/HerbCaudill/leo/scripts/ci-watch/run.ts"
      ];
      StartInterval = 120;
      RunAtLoad = true;
      StandardOutPath = "${stateDirectory}/watch.log";
      StandardErrorPath = "${stateDirectory}/watch.log";
      EnvironmentVariables = {
        HOME = homeDirectory;
        LANG = "en_US.UTF-8";
        PATH = "${homeDirectory}/.t3/bin:${homeDirectory}/.local/bin:/etc/profiles/per-user/${username}/bin:${pkgs.nodejs_24}/bin:/usr/bin:/bin:/usr/sbin:/sbin";
      };
    };
  };
}
