
# Load secrets (not in source control)
[[ -f ~/.secrets ]] && source ~/.secrets

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"



# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="herb"

# update automatically without asking
zstyle ':omz:update' mode auto

plugins=(
  git
  zsh-autosuggestions
  zsh-syntax-highlighting
)

source $ZSH/oh-my-zsh.sh

# aliases

alias px="pnpm -w nx"
alias pxstory="px storybook stories"

alias profile="code ~/.zshrc"
alias reload="exec zsh"
alias zshconfig="code ~/.zshrc"
alias ohmyzsh="code ~/.oh-my-zsh"
alias theme="code ~/.oh-my-zsh/custom/themes/herb.zsh-theme"

alias insiders="open -a 'Visual Studio Code - Insiders'"

alias nodets="node --loader ts-node/esm --experimental-specifier-resolution=node"

alias updatepnpm="curl -fsSL https://get.pnpm.io/install.sh | sh -"
alias updateclaude="claude install latest --force"

alias new="npx degit herbcaudill/starter"

alias i="pnpm install"
alias b="pnpm build"
alias d="pnpm dev"
alias f="pnpm format"
alias t="pnpm test"
alias start="pnpm start"
alias lint="pnpm lint"
alias wa="pnpm watch"
alias s="pnpm storybook"
alias ibt="pnpm install && pnpm build && pnpm test run"
alias bs="pnpm build && pnpm start"
alias bench="pnpm benchmark"
alias up="pnpm update -i --latest"
alias type="pnpm typecheck"
alias ralph="cls && pnpm ralph"

# purge node_modules/dist/etc. & reinstall
alias pg="rm -rf **/node_modules; rm -rf **/dist; rm -rf .next; i"

# prune pnpm store then purge
alias prune="pnpm store prune; pg"

# purge & reinstall + dev
alias pd="pg; d"

# purge & reinstall + build
alias pb="pg; d"

alias debug="DEBUG=localfirst*,automerge* DEBUG_COLORS=1"

alias shad="npx shadcn-ui@latest"

function bump_version() {
  npm version $1 $2 --git-tag-version=false
  git add .
  VERSION=$(node -p -e "require('./package.json').version")
  git commit -m "bump for release: $VERSION"
}

function clone() {
  git clone https://github.com/$1.git ~/Code/$1
  cd ~/Code/$1
  code .
}

alias alpha="bump_version prerelease --preid=alpha"
alias beta="bump_version prerelease --preid=beta"
alias patch="bump_version patch"
alias minor="bump_version minor"
alias major="bump_version major"

alias yi="yarn install"
alias yb="yarn build"
alias yd="yarn dev"
alias yt="yarn test"

alias cls="clear"
alias l="ls -lah"
alias c="code ."
alias cl="cls && claude --dangerously-skip-permissions"
alias clbd="cls && claude '/issues' --dangerously-skip-permissions"
alias x="open ."
alias h="cd ~"
alias nm="open ./node_modules"

# graphite stuff
alias gtb= "gt bottom"
alias gtbi="gt info"
alias gtbr="gt restack --only"
alias gtco="gt checkout"
alias gtd= "gt down"
alias gtdr="gt restack --downstack"
alias gtll="gt log long"
alias gtls="gt log short"
alias gtr= "gt restack"
alias gtrn="gt rename"
alias gts= "gt sync"
alias gtss="gt submit --stack"
alias gtt= "gt top"
alias gttr="gt track"
alias gtu= "gt up"
alias gtur="gt restack --upstack"
alias gtut="gt untrack"

alias flaky="node ./scripts/flaky.js"

alias nx="./nx"

alias nowrap="tput rmam"
alias wrap="tput smam"

function killport {
  lsof -i tcp:$1 | awk 'NR!=1 {print $2}' | xargs kill
} 

function testlog {
  pnpm test:log $1 -- -t $2 |& node ./scripts/clean-log.js > ./.logs/log.txt
}

# https://superuser.com/questions/1532688
set enable-bracketed-paste Off

# Use vscode as editor
export VISUAL=code
export EDITOR="$VISUAL"

echo "source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" >> ${ZDOTDIR:-$HOME}/.zshrcsource /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# pnpm
export PNPM_HOME="/Users/herbcaudill/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end
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

# ---- Git Worktree Helpers ----
# Worktrees stored in sibling directory: my-project → my-project-worktrees/

_wt_dir() {
  local root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  [[ -f "$root/.git" ]] && root=$(git -C "$root" rev-parse --git-common-dir | xargs dirname)
  echo "${root}-worktrees"
}

# wt <branch> [base] - Create worktree with new branch
wt() {
  [[ -z "$1" ]] && { echo "Usage: wt <branch> [base]"; return 1; }
  local branch="$1" base="${2:-HEAD}"
  local wt_dir=$(_wt_dir) || return 1
  mkdir -p "$wt_dir"
  git worktree add -b "$branch" "$wt_dir/$branch" "$base" && cd "$wt_dir/$branch"
}

# wtt <branch> - Create worktree tracking existing branch
wtt() {
  [[ -z "$1" ]] && { echo "Usage: wtt <branch>"; return 1; }
  local wt_dir=$(_wt_dir) || return 1
  mkdir -p "$wt_dir"
  git worktree add "$wt_dir/$1" "$1" && cd "$wt_dir/$1"
}

# wtcd [branch] - Navigate to worktree (no args = main repo)
wtcd() {
  if [[ -z "$1" ]]; then
    local root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
    [[ -f "$root/.git" ]] && root=$(git -C "$root" rev-parse --git-common-dir | xargs dirname)
    cd "$root"
  else
    local wt_dir=$(_wt_dir) || return 1
    [[ -d "$wt_dir/$1" ]] && cd "$wt_dir/$1" || { echo "Not found: $1"; return 1; }
  fi
}

# wtls - List worktrees with status
wtls() {
  local wt_dir=$(_wt_dir) || return 1
  git worktree list --porcelain | awk '/^worktree/{print $2}' | while read wt; do
    local name=$(basename "$wt")
    local branch=$(git -C "$wt" branch --show-current 2>/dev/null)
    local dirty=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    local marker=""
    [[ "$dirty" -gt 0 ]] && marker=" ●"
    printf "%-20s %s%s\n" "$name" "$branch" "$marker"
  done
}

# wtrm <branch> [-f] [-b] - Remove worktree (-b also deletes branch)
wtrm() {
  [[ -z "$1" ]] && { echo "Usage: wtrm <branch> [-f] [-b]"; return 1; }
  local branch="$1" force="" delbranch=false
  shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -f) force="--force" ;;
      -b) delbranch=true ;;
    esac
    shift
  done
  local wt_dir=$(_wt_dir) || return 1
  git worktree remove $force "$wt_dir/$branch" && $delbranch && git branch -D "$branch"
}

# wtclean - Remove worktrees for merged branches
wtclean() {
  local wt_dir=$(_wt_dir) || return 1
  local main=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
  [[ -z "$main" ]] && main="main"
  git branch --merged "$main" | grep -v "$main" | tr -d ' ' | while read branch; do
    [[ -d "$wt_dir/$branch" ]] || continue
    echo -n "Remove $branch (merged)? [y/N] "
    read -r yn
    [[ "$yn" =~ ^[Yy]$ ]] && git worktree remove "$wt_dir/$branch" && git branch -d "$branch"
  done
}

# wtclone <url> [name] - Clone repo optimized for worktrees
wtclone() {
  [[ -z "$1" ]] && { echo "Usage: wtclone <url> [name]"; return 1; }
  local url="$1" name="${2:-$(basename "$1" .git)}"
  git clone --bare "$url" "$name/.bare"
  echo "gitdir: .bare" > "$name/.git"
  git -C "$name" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
  git -C "$name" fetch origin
  cd "$name"
  echo "Cloned. Use 'wt <branch>' to create worktrees."
}

# Tab completion for wtcd/wtrm
_wt_branches() {
  local wt_dir=$(_wt_dir 2>/dev/null)
  [[ -d "$wt_dir" ]] && compadd -- "$wt_dir"/*(:t)
}
compdef _wt_branches wtcd wtrm