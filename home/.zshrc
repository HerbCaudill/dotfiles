#### ENVIRONMENT
[[ -f ~/.secrets ]] && source ~/.secrets   # tokens, api keys
[[ -f ~/.localenv ]] && source ~/.localenv # machine-specific config (SPRITE_NAME, EDITOR, etc.)

# homebrew
[[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
[[ -x /home/linuxbrew/.linuxbrew/bin/brew ]] && eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

#### ZSH SETUP

# oh-my-zsh
export ZSH="$HOME/.oh-my-zsh" # Path to oh-my-zsh installation.
ZSH_THEME="herb" # See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
zstyle ':omz:update' mode auto # update automatically without asking
source $ZSH/oh-my-zsh.sh

plugins=(
  git
  zsh-autosuggestions
  zsh-syntax-highlighting
  zsh-shift-select
)

DISABLE_AUTO_TITLE="true" # otherwise terminal title contains full path, which vscode doesn't display gracefully

set enable-bracketed-paste Off # https://superuser.com/questions/1532688

# Use vscode as editor
export VISUAL=code
export EDITOR="$VISUAL"


#### ALIASES

# dxos
alias px="pnpm -w nx"
alias pxstory="px storybook stories"

# zsh
alias profile="code ~/.zshrc"
alias reload="exec zsh"
alias zshconfig="code ~/.zshrc"
alias ohmyzsh="code ~/.oh-my-zsh"
alias theme="code ~/.oh-my-zsh/custom/themes/herb.zsh-theme"

# updates
alias updatebd="curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash"
alias updateclaude="claude install latest --force"
alias updatecodex="pnpm install -g @openai/codex"
alias updatemcp="npm update -g @upstash/context7-mcp @playwright/mcp && uv tool upgrade serena-agent"

# bd
alias bdl="bd list --pretty"
alias bdr="bd list --pretty --ready"
alias bdlw="bd list --pretty --watch"
alias bdrw="bd list --pretty --ready --watch"

# Kill all bd daemons and restart them
bdrestart() {
  local workspaces=($(bd daemon list --json 2>/dev/null | python3 -c "import sys,json; [print(d['WorkspacePath']) for d in json.load(sys.stdin)]" 2>/dev/null))
  if [[ ${#workspaces[@]} -eq 0 ]]; then
    echo "No bd daemons running"
    return 0
  fi
  echo "Stopping ${#workspaces[@]} daemon(s)..."
  bd daemon killall --force 2>/dev/null
  sleep 1
  for ws in "${workspaces[@]}"; do
    echo "Starting daemon in $ws"
    (cd "$ws" && bd daemon start)
  done
  sleep 1
  bd daemon status --all
}

# pnpm 
alias b="pnpm build"
alias bench="pnpm benchmark"
alias bs="pnpm build && pnpm start"
alias d="pnpm dev"
alias f="pnpm format"
alias i="pnpm install"
alias ibt="pnpm install && pnpm build && pnpm test run"
alias lint="pnpm lint"
alias pb="pg; d" # purge & reinstall + build
alias pd="pg; d" # purge & reinstall + dev
alias pg="rm -rf **/node_modules; rm -rf **/dist; rm -rf .next; i" # purge node_modules/dist/etc. & reinstall
alias prune="pnpm store prune; pg" # prune pnpm store then purge
alias ralph="cls && pnpm ralph"
alias s="pnpm storybook"
alias start="pnpm start"
alias t="pnpm test"
alias type="pnpm typecheck"
alias up="pnpm update -i --latest"
alias updatepnpm="curl -fsSL https://get.pnpm.io/install.sh | sh -"
alias wa="pnpm watch"

# shadcn-ui
alias shad="npx shadcn-ui@latest"

# npm versions
function bump() {
  npm version $1 $2 --git-tag-version=false
  git add .
  VERSION=$(node -p -e "require('./package.json').version")
  git commit -m "bump for release: $VERSION"
}
alias alpha="bump prerelease --preid=alpha"
alias beta="bump prerelease --preid=beta"
alias patch="bump patch"
alias minor="bump minor"
alias major="bump major"

# yarn
alias yi="yarn install"
alias yb="yarn build"
alias yd="yarn dev"
alias yt="yarn test"

# misc bash
alias cls="clear"
alias l="ls -lah"
alias c="code ."
alias cl="cls && claude --dangerously-skip-permissions"
alias clbd="cls && claude '/manage-tasks' --model sonnet --dangerously-skip-permissions"
alias x="open ."
alias h="cd ~"
alias nm="open ./node_modules"

# terminal word wrapping
alias nowrap="tput rmam"
alias wrap="tput smam"

#### FUNCTIONS

# kill process using port, e.g. `killport 3000`
function killport {
  lsof -i tcp:$1 | awk 'NR!=1 {print $2}' | xargs kill
} 

#### SPRITE HELPERS

sp() { if [ -n "$1" ]; then sprite console -s "$@"; else sprite console; fi }
alias spl="sprite ls"

# mount sprites.dev fs
spfs() {
  local sprite_name="$1"
  local mount_point="/tmp/sprite-mount"
  mkdir -p "$mount_point"
  if lsof -t -i :2000 > /dev/null 2>&1; then
    read -r "yn?A Sprite is already mounted, unmount it? (y/n) "
    [ "$yn" = "y" ] || return 1
    diskutil umount "$mount_point" 2>/dev/null
    lsof -t -i :2000 | xargs kill 2>/dev/null
    sleep 1
  fi
  sprite proxy -s "$sprite_name" 2000:22 &
  sleep 1  # wait for the proxy to start
  sshfs -o reconnect,ServerAliveInterval=15,ServerAliveCountMax=3 \
    "sprite@localhost:" -p 2000 "$mount_point"
  cd "$mount_point" || return 1
}

# destroy all sprites
sppurge() {
  local sprites=$(sprite list)
  if [[ -z "$sprites" ]]; then
    echo "No sprites to destroy"
    return
  fi
  echo "$sprites" | while read -r name; do
    sprite destroy -s "$name" --force
  done
}

#### GIT WORKTREE HELPERS

# Scripts in ~/.local/bin handle the work; these wrappers handle cd
# Worktrees stored in sibling directory: my-project → .my-project-worktrees/

wt() { local dir; dir=$(command wt "$@") && cd "$dir"; }
wtt() { local dir; dir=$(command wtt "$@") && cd "$dir"; }
wtcd() { local dir; dir=$(command wtcd "$@") && cd "$dir"; }
wtclone() { local dir; dir=$(command wtclone "$@") && cd "$dir"; }

# Tab completion for wtcd/wtrm
_wt_branches() {
  local wt_dir=$(_wt_dir 2>/dev/null)
  [[ -d "$wt_dir" ]] && compadd -- "$wt_dir"/*(:t)
}
compdef _wt_branches wtcd wtrm


#### TAB COMPLETION ETC.

# pnpm
if [[ "$OSTYPE" == "darwin"* ]]; then
  export PNPM_HOME="$HOME/Library/pnpm"
else
  export PNPM_HOME="$HOME/.local/share/pnpm"
fi
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# initialize asdf
[[ -f "$HOME/.asdf/asdf.sh" ]] && source "$HOME/.asdf/asdf.sh"

# graphite code completion

#compdef gt
###-begin-gt-completions-###
#
# yargs command completion script
#
# Installation: gt completion >> ~/.zshrc
#    or gt completion >> ~/.zprofile on OSX.
#
_gt_yargs_completions()
{
  local reply
  local si=$IFS
  IFS=$'
' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" gt --get-yargs-completions "${words[@]}"))
  IFS=$si
  _describe 'values' reply
}
compdef _gt_yargs_completions gt
###-end-gt-completions-###

export PATH="$HOME/.local/bin:$PATH"

## Time Claude CLI startup (ms to first prompt)
timeclaude() {
  local start=$EPOCHREALTIME
  expect -c 'spawn claude; expect -re {❯}; exit' > /dev/null 2>&1
  printf '%.0f\n' $(( (EPOCHREALTIME - start) * 1000 ))
}

# proto
export PROTO_HOME="$HOME/.proto";
export PATH="$PROTO_HOME/shims:$PROTO_HOME/bin:$PATH";

# Terminal title
if [[ -n "$SPRITE_NAME" ]]; then
  precmd() { print -Pn "\e]0;👾 $SPRITE_NAME\a" }
  if [[ -n "$SPRITE_REPO_DIR" && -d "$SPRITE_REPO_DIR" ]]; then
    cd "$SPRITE_REPO_DIR"
  else
    cd ~/code
  fi
else
  precmd() { print -Pn "\e]0;%~\a" }
fi
