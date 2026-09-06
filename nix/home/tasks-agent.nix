{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.tasksAgent;
  root = "${config.home.homeDirectory}/Library/Application Support/Tasks";
  source = ../../scripts/tasks-agent;
  space = if cfg.spaceId == null then "" else cfg.spaceId;
  controller = pkgs.writeShellScriptBin "tasks-agent" ''
    exec ${pkgs.nodejs_24}/bin/node ${source}/main.ts \
      --root ${lib.escapeShellArg root} \
      --space ${lib.escapeShellArg space} \
      --pnpm ${pkgs.pnpm}/bin/pnpm "$@"
  '';
  cli = pkgs.writeShellScriptBin "tasks" ''
    set -eu
    release="$(${controller}/bin/tasks-agent release-path)"
    cd "$release"
    exec ${pkgs.nodejs_24}/bin/node --import tsx src/agent/cli/main.ts \
      --socket ${lib.escapeShellArg "${root}/agent/control.sock"} "$@"
  '';
  daemon = pkgs.writeShellScriptBin "tasks-agent-service" ''
    set -eu
    release="$(${controller}/bin/tasks-agent release-path)"
    cd "$release"
    exec ${pkgs.nodejs_24}/bin/node --import tsx src/agent/service/main.ts \
      --state-dir ${lib.escapeShellArg "${root}/agent"} \
      --space ${lib.escapeShellArg space}
  '';
in
{
  options.services.tasksAgent = {
    enable = lib.mkEnableOption "the reviewed local Tasks peer and launchers";
    spaceId = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "The one explicitly enrolled Tasks space; never an invitation credential.";
    };
    autoStart = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Start at login and restart after exit, only after enrollment and runtime verification.";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.spaceId != null && cfg.spaceId != "";
        message = "Tasks agent activation requires an explicit selected spaceId.";
      }
    ];
    home.packages = [
      controller
      cli
    ];
    home.activation.tasksAgentPrivateDirectories =
      lib.hm.dag.entryBetween [ "setupLaunchAgents" ] [ "writeBoundary" ]
        ''
          ${pkgs.coreutils}/bin/install -d -m 0700 \
            ${lib.escapeShellArg root} ${lib.escapeShellArg "${root}/agent"}
        '';
    launchd.agents.tasks-agent = {
      enable = true;
      config = {
        Label = "com.herbcaudill.tasks-agent";
        ProgramArguments = [ "${daemon}/bin/tasks-agent-service" ];
        RunAtLoad = cfg.autoStart;
        KeepAlive = cfg.autoStart;
        ThrottleInterval = 60;
        ExitTimeOut = 75;
        ProcessType = "Background";
        Umask = 63;
        StandardOutPath = "${root}/agent/stdout.log";
        StandardErrorPath = "${root}/agent/stderr.log";
        EnvironmentVariables = {
          HOME = config.home.homeDirectory;
          LANG = "en_US.UTF-8";
          PATH = "${pkgs.nodejs_24}/bin:/usr/bin:/bin";
        };
      };
    };
  };
}
