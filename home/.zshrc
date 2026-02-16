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

alias sp="sprite console -s"
alias spl="sprite ls"

# mount sprites.dev fs
spfs() {
  local sprite_name="${1:-$(sprite use)}"
  local mount_point="/tmp/sprite-${sprite_name}"
  mkdir -p "$mount_point"
  sshfs -o reconnect,ServerAliveInterval=15,ServerAliveCountMax=3 \
    "sprite@${sprite_name}.sprites.dev:" "$mount_point"
  cd "$mount_point"
}

# create sprite + run setup-sprite.ts; sets $SP_NAME for callers
_sp_setup() {
  SP_GH_TOKEN=$(gh auth token)
  if [[ -z "$SP_GH_TOKEN" ]]; then
    echo "Not authenticated with gh - run 'gh auth login' first"
    return 1
  fi

  SP_NAME="$1"
  local repo_user=""
  local repo_name=""

  # If no name given and we're at a git repo root without .sprite file, use repo name
  if [[ -z "$SP_NAME" && -d ".git" && ! -f ".sprite" ]]; then
    local remote_url=$(git remote get-url origin 2>/dev/null)
    if [[ -n "$remote_url" ]]; then
      local repo_path=$(echo "$remote_url" | sed -E 's#.*(github\.com[:/])##' | sed 's/\.git$//')
      repo_name=$(basename "$repo_path")
      repo_user=$(dirname "$repo_path")
      SP_NAME="dev-$repo_name"
    fi
  fi

  SP_NAME="${SP_NAME:-$(LC_ALL=C tr -dc 'a-z' </dev/urandom | head -c 5)}"

  # Check if sprite already exists
  if sprite list | grep -q "^${SP_NAME}$"; then
    echo "Sprite '$SP_NAME' already exists"
    return 0
  fi

  sprite create --skip-console $SP_NAME | head -1
  [[ -n "$repo_user" ]] && sprite use $SP_NAME | head -1

  sprite exec -s $SP_NAME bash -c "\
    export GITHUB_TOKEN='$SP_GH_TOKEN' \
           SPRITE_NAME='$SP_NAME' \
           REPO_USER='$repo_user' \
           REPO_NAME='$repo_name'; \
    curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/scripts/setup-sprite.ts | npm_config_update_notifier=false npx -y tsx -"
}

# create sprite with setup + open console
spc() {
  _sp_setup "$1" || return 1
  sprite console -s $SP_NAME
}

# create sprite with OpenClaw setup + open dashboard
spoc() {
  _sp_setup "$1" || return 1
  local name=$SP_NAME
  local oc_path='export PATH="$HOME/.local/bin:/.sprite/languages/node/nvm/versions/node/v22.20.0/bin:$PATH"'

  # Run setup-openclaw.ts if not already configured
  if ! sprite exec -s $name bash -c "test -f ~/.openclaw/openclaw.json" 2>/dev/null; then
    echo "Setting up OpenClaw..."
    sprite exec -s $name bash -c "\
      export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY' \
             TELEGRAM_BOT_TOKEN='$TELEGRAM_BOT_TOKEN' \
             OPENAI_API_KEY='$OPENAI_API_KEY' \
             GOOGLE_PLACES_API_KEY='$GOOGLE_PLACES_API_KEY' \
             GEMINI_API_KEY='$GEMINI_API_KEY' \
             BRAVE_SEARCH_API_KEY='$BRAVE_SEARCH_API_KEY'; \
      curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/scripts/setup-openclaw.ts | npm_config_update_notifier=false npx -y tsx -"
  fi

  # Make sprite URL public
  sprite url update -s $name --auth public

  # Ensure gateway service is running
  local gw_status=$(sprite exec -s $name bash -c "sprite-env services list" 2>/dev/null \
    | python3 -c "import sys,json; svcs=json.load(sys.stdin); print(next((s['state']['status'] for s in svcs if s['name']=='openclaw-gateway'),'missing'))" 2>/dev/null)
  if [[ "$gw_status" != "running" ]]; then
    echo "Starting gateway..."
    sprite exec -s $name bash -c "sprite-env services stop openclaw-gateway 2>/dev/null; sleep 1; sprite-env services start openclaw-gateway 2>/dev/null"
    sleep 2
  fi

  # Read the gateway token from the sprite's openclaw.json
  local gateway_token=$(sprite exec -s $name bash -c "cat ~/.openclaw/openclaw.json" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['gateway']['auth']['token'])")

  if [[ -z "$gateway_token" ]]; then
    echo "Error: could not read gateway token from sprite"
    return 1
  fi

  # Build dashboard URL
  local sprite_url=$(sprite url -s $name 2>&1 | grep '^URL:' | awk '{print $2}')
  local dashboard_url="${sprite_url}/#token=${gateway_token}"

  # Open dashboard in browser
  echo "Opening dashboard..."
  open "$dashboard_url"

  # Poll for pending device pairing (up to 15s)
  echo "Waiting for device pairing..."
  local pending_id=""
  for i in {1..5}; do
    sleep 3
    pending_id=$(sprite exec -s $name bash -c \
      "$oc_path; openclaw devices list --json" 2>/dev/null \
      | python3 -c "import sys,json; p=json.load(sys.stdin).get('pending',[]); print(p[0]['deviceId'] if p else '')" 2>/dev/null)
    [[ -n "$pending_id" ]] && break
  done

  if [[ -n "$pending_id" ]]; then
    echo "Approving device..."
    sprite exec -s $name bash -c \
      "$oc_path; openclaw devices approve '$pending_id'"
  else
    echo "No pending device found (you may need to refresh the dashboard)"
  fi

  echo ""
  echo "Dashboard: $dashboard_url"
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
