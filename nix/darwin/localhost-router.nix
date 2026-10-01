{
  lib,
  pkgs,
  username,
  ...
}:
let
  portless = pkgs.callPackage ../packages/portless.nix { };
  homeDirectory = "/Users/${username}";
  stateDir = "${homeDirectory}/.portless";
  launcher = pkgs.writeShellScriptBin "localhost-dev" ''
    export LOCALHOST_DEV_PORTLESS=${portless}/bin/portless
    export LOCALHOST_DEV_PORTLESS_MODULE=${portless}/lib/portless/dist/index.js
    exec ${pkgs.nodejs_24}/bin/node --experimental-strip-types ${../../scripts/localhost-router}/localhostDev.ts "$@"
  '';
  daemon = pkgs.writeShellScript "localhost-router-daemon" ''
    export SUDO_UID="$(/usr/bin/id -u ${username})"
    export SUDO_GID="$(/usr/bin/id -g ${username})"
    exec ${portless}/bin/portless proxy start --foreground --https --port 443 --skip-trust
  '';
in
{
  environment.systemPackages = [
    portless
    launcher
  ];
  system.activationScripts.preActivation.text = lib.mkAfter ''
    ${pkgs.coreutils}/bin/install -d -m 0700 -o ${username} -g staff "${stateDir}"
    ${pkgs.coreutils}/bin/env \
      PORTLESS_STATE_DIR="${stateDir}" \
      SUDO_UID="$(/usr/bin/id -u ${username})" \
      SUDO_GID="$(/usr/bin/id -g ${username})" \
      ${portless}/bin/portless trust
  '';
  launchd.daemons."localhost-router".serviceConfig = {
    Label = "com.herbcaudill.localhost-router";
    ProgramArguments = [ "${daemon}" ];
    RunAtLoad = true;
    KeepAlive = true;
    ThrottleInterval = 10;
    Umask = 63;
    StandardOutPath = "${stateDir}/service.log";
    StandardErrorPath = "${stateDir}/service.log";
    EnvironmentVariables = {
      HOME = homeDirectory;
      PATH = "${
        lib.makeBinPath [
          pkgs.openssl
          pkgs.git
        ]
      }:/usr/bin:/bin:/usr/sbin:/sbin";
      PORTLESS_STATE_DIR = stateDir;
      PORTLESS_PORT = "443";
      PORTLESS_HTTPS = "1";
      PORTLESS_SYNC_HOSTS = "0";
      PORTLESS_LAN = "0";
      PORTLESS_WILDCARD = "0";
      PORTLESS_TLD = "localhost";
    };
  };
}
