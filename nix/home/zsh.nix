{ dotfilesRoot, pkgs, ... }:
{
  home.sessionPath = [
    "$HOME/.local/bin"
    "$HOME/.local/share/pnpm"
    "$HOME/.proto/bin"
    "$HOME/.proto/shims"
    "$HOME/Library/pnpm"
  ];

  programs.zsh = {
    enable = true;
    autosuggestion.enable = true;
    enableCompletion = true;
    syntaxHighlighting.enable = true;
    envExtra = ''
      [[ -f ~/.secrets ]] && source ~/.secrets
      [[ -f ~/.localenv ]] && source ~/.localenv

      export BEADS_DOLT_SERVER_MODE=1
      export BEADS_DOLT_SHARED_SERVER=1
      export BEADS_DOLT_SERVER_HOST=127.0.0.1
      export BEADS_DOLT_SERVER_PORT=3308

      export PROTO_HOME="$HOME/.proto"
      export PNPM_HOME="$HOME/Library/pnpm"
      export PATH="$PROTO_HOME/shims:$PROTO_HOME/bin:$PATH"
      export VISUAL=code
      export EDITOR="$VISUAL"
      export CLOUDSDK_PYTHON=${pkgs.python313}/bin/python3
    '';
    initContent = builtins.readFile ./zsh-init.zsh;
    "oh-my-zsh" = {
      enable = true;
      custom = "${dotfilesRoot}/home/.oh-my-zsh/custom";
      plugins = [ "git" ];
      theme = "herb";
    };
    shellAliases = {
      alpha = "bump prerelease --preid=alpha";
      b = "pnpm build";
      bench = "pnpm benchmark";
      beta = "bump prerelease --preid=beta";
      bdl = "bd list --pretty";
      bdr = "bd list --pretty --ready";
      bdlw = "bd list --pretty --watch";
      bdrw = "bd list --pretty --ready --watch";
      bs = "pnpm build && pnpm start";
      c = "code .";
      cl = "cls && claude --dangerously-skip-permissions";
      clbd = "cls && claude '/manage-tasks' --model sonnet --dangerously-skip-permissions";
      cls = "clear";
      d = "pnpm dev";
      f = "pnpm format";
      h = "cd ~";
      i = "pnpm install";
      ibt = "pnpm install && pnpm build && pnpm test run";
      l = "ls -lah";
      lint = "pnpm lint";
      major = "bump major";
      minor = "bump minor";
      nm = "open ./node_modules";
      nowrap = "tput rmam";
      obs = "code ~/Code/HerbCaudill/notes";
      ohmyzsh = "code ~/Code/HerbCaudill/dotfiles/home/.oh-my-zsh";
      patch = "bump patch";
      pb = "pg; d";
      pd = "pg; d";
      pg = "rm -rf **/node_modules; rm -rf **/dist; rm -rf .next; i";
      profile = "code ~/Code/HerbCaudill/dotfiles/nix/home/zsh.nix";
      prune = "pnpm store prune; pg";
      px = "pnpm -w nx";
      pxstory = "px storybook stories";
      ralph = "cls && pnpm ralph";
      reload = "exec zsh";
      s = "pnpm storybook";
      shad = "npx shadcn-ui@latest";
      start = "pnpm start";
      t = "pnpm test";
      theme = "code ~/Code/HerbCaudill/dotfiles/home/.oh-my-zsh/custom/themes/herb.zsh-theme";
      timepi = "time pi";
      type = "pnpm typecheck";
      up = "pnpm update -i --latest";
      updatebd = "curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash";
      updateclaude = "claude install latest --force";
      updatecodex = "pnpm install -g @openai/codex";
      updatemachine = "sudo nix run github:LnL7/nix-darwin/master#darwin-rebuild -- switch --flake ~/Code/HerbCaudill/dotfiles#herbcaudill";
      updatemcp = "npm update -g @upstash/context7-mcp @playwright/mcp && uv tool upgrade serena-agent";
      updatenix = "nix flake update ~/Code/HerbCaudill/dotfiles";
      updatepi = "pnpm install -g @mariozechner/pi-coding-agent";
      updatepnpm = "curl -fsSL https://get.pnpm.io/install.sh | sh -";
      wa = "pnpm watch";
      wrap = "tput smam";
      x = "open .";
      yb = "yarn build";
      yd = "yarn dev";
      yi = "yarn install";
      yt = "yarn test";
      zshconfig = "code ~/Code/HerbCaudill/dotfiles/nix/home/zsh.nix";
    };
  };
}
