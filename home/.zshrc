
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
alias clbd="cls && claude '/manage-tasks' --dangerously-skip-permissions"
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