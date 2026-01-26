#### SECRETS
[[ -f ~/.secrets ]] && source ~/.secrets # currently just contains porkbun api credentials

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

alias updateclaude="claude install latest --force"

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
alias ta="pnpm test:all"
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

# mount sprites.dev fs
sc() {
  local sprite_name="${1:-$(sprite use)}"
  local mount_point="/tmp/sprite-${sprite_name}"
  mkdir -p "$mount_point"
  sshfs -o reconnect,ServerAliveInterval=15,ServerAliveCountMax=3 \
    "sprite@${sprite_name}.sprites.dev:" "$mount_point"
  cd "$mount_point"
}

# create sprite with setup
spc() {
  local name="$1"
  if [[ -z "$name" ]]; then
    echo "Usage: spc <sprite-name>"
    return 1
  fi
  if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "GITHUB_TOKEN not set in ~/.secrets"
    return 1
  fi
  sprite create "$name" --skip-console
  sprite exec "GITHUB_TOKEN=$GITHUB_TOKEN curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/sprite-setup.sh | bash"
  sprite console
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

# proto
export PROTO_HOME="$HOME/.proto";
export PATH="$PROTO_HOME/shims:$PROTO_HOME/bin:$PATH";


