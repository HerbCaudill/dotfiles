{
  config,
  dotfilesRoot,
  lib,
  pkgs,
  ...
}:
let
  configPath = "${config.home.homeDirectory}/.codex/config.toml";
in
{
  home.activation.disableBundledSkillCreator = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    ${pkgs.nodejs}/bin/node ${lib.escapeShellArg "${dotfilesRoot}/scripts/codex-config/syncCodexSkillConfig.ts"} \
      ${lib.escapeShellArg configPath} \
      skill-creator
  '';
}
