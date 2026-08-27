{ config, dotfilesRoot, ... }:
let
  mkRepoSymlink = path: config.lib.file.mkOutOfStoreSymlink "${dotfilesRoot}/${path}";
in {
  home.file = {
    ".claude/CLAUDE.md".source = mkRepoSymlink "home/.claude/CLAUDE.md";
    ".claude/agents".source = mkRepoSymlink "home/.claude/agents";
    ".claude/settings.json".source = mkRepoSymlink "home/.claude/settings.json";
    ".claude/skills".source = mkRepoSymlink "home/.claude/skills";
    ".claude/statusline.js".source = mkRepoSymlink "home/.claude/statusline.js";
    ".codex/AGENTS.md".source = mkRepoSymlink "home/.claude/CLAUDE.md";
    ".codex/skills".source = mkRepoSymlink "home/.claude/skills";
    ".config/bd/config.yaml".source = mkRepoSymlink "home/.config/bd/config.yaml";
    ".oh-my-zsh/custom/themes/herb.zsh-theme".source = mkRepoSymlink "home/.oh-my-zsh/custom/themes/herb.zsh-theme";
    ".pi/agent/AGENTS.md".source = mkRepoSymlink "home/.claude/CLAUDE.md";
    ".pi/agent/extensions".source = mkRepoSymlink "home/.pi/agent/extensions";
    ".pi/agent/settings.json".source = mkRepoSymlink "home/.pi/agent/settings.json";
    ".pi/agent/skills".source = mkRepoSymlink "home/.claude/skills";
    ".prettierrc".source = mkRepoSymlink "home/.prettierrc";
    ".ssh/config".source = mkRepoSymlink "home/.ssh/config";
    ".vscode/extensions/herbcaudill.markdown-preview-tweaks".source =
      mkRepoSymlink "home/.vscode/extensions/markdown-preview-tweaks";
    "iterm2/com.googlecode.iterm2.plist".source = mkRepoSymlink "home/iterm2/com.googlecode.iterm2.plist";

    ".local/bin/_wt_dir".source = mkRepoSymlink "home/.local/bin/_wt_dir";
    ".local/bin/agent-transcripts-sync".source = mkRepoSymlink "home/.local/bin/agent-transcripts-sync";
    ".local/bin/create-daily-note".source = mkRepoSymlink "home/.local/bin/create-daily-note";
    ".local/bin/dr".source = mkRepoSymlink "home/.local/bin/dr";
    ".local/bin/drsync".source = mkRepoSymlink "home/.local/bin/drsync";
    ".local/bin/email-processing".source = mkRepoSymlink "home/.local/bin/email-processing";
    ".local/bin/devresults-vm".source = mkRepoSymlink "home/.local/bin/devresults-vm";
    ".local/bin/gh-sync".source = mkRepoSymlink "home/.local/bin/gh-sync";
    ".local/bin/github-pr-task-sync".source = mkRepoSymlink "home/.local/bin/github-pr-task-sync";
    ".local/bin/gws-delegated".source = mkRepoSymlink "home/.local/bin/gws-delegated";
    ".local/bin/index-project".source = mkRepoSymlink "home/.local/bin/index-project";
    ".local/bin/obsidian-sync".source = mkRepoSymlink "home/.local/bin/obsidian-sync";
    ".local/bin/personal-info-sync".source = mkRepoSymlink "home/.local/bin/personal-info-sync";
    ".local/bin/update-agent-harnesses".source = mkRepoSymlink "home/.local/bin/update-agent-harnesses";
    ".local/bin/serena".source = mkRepoSymlink "home/.local/bin/serena";
    ".local/bin/serena-mcp-server".source = mkRepoSymlink "home/.local/bin/serena-mcp-server";
    ".local/bin/tslsp".source = mkRepoSymlink "home/.local/bin/tslsp";
    ".local/bin/wt".source = mkRepoSymlink "home/.local/bin/wt";
    ".local/bin/wtcd".source = mkRepoSymlink "home/.local/bin/wtcd";
    ".local/bin/wtclean".source = mkRepoSymlink "home/.local/bin/wtclean";
    ".local/bin/wtclone".source = mkRepoSymlink "home/.local/bin/wtclone";
    ".local/bin/wtls".source = mkRepoSymlink "home/.local/bin/wtls";
    ".local/bin/wtrm".source = mkRepoSymlink "home/.local/bin/wtrm";
    ".local/bin/wtt".source = mkRepoSymlink "home/.local/bin/wtt";
  };
}
