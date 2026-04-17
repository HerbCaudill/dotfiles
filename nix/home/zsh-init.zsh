zstyle ':omz:update' mode auto
DISABLE_AUTO_TITLE="true"
set enable-bracketed-paste Off

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

bump() {
  npm version $1 $2 --git-tag-version=false
  git add .
  VERSION=$(node -p -e "require('./package.json').version")
  git commit -m "bump for release: $VERSION"
}

killport() {
  lsof -i tcp:$1 | awk 'NR!=1 {print $2}' | xargs kill
}

sp() { if [ -n "$1" ]; then sprite console -s "$@"; else sprite console; fi }

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
  sleep 1
  sshfs -o reconnect,ServerAliveInterval=15,ServerAliveCountMax=3 \
    "sprite@localhost:" -p 2000 "$mount_point"
  cd "$mount_point" || return 1
}

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

wt() { local dir; dir=$(command wt "$@") && cd "$dir"; }
wtt() { local dir; dir=$(command wtt "$@") && cd "$dir"; }
wtcd() { local dir; dir=$(command wtcd "$@") && cd "$dir"; }
wtclone() { local dir; dir=$(command wtclone "$@") && cd "$dir"; }

_wt_branches() {
  local wt_dir=$(_wt_dir 2>/dev/null)
  [[ -d "$wt_dir" ]] && compadd -- "$wt_dir"/*(:t)
}
compdef _wt_branches wtcd wtrm

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

if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

if [ -f '/Users/herbcaudill/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/herbcaudill/google-cloud-sdk/path.zsh.inc'; fi
if [ -f '/Users/herbcaudill/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/herbcaudill/google-cloud-sdk/completion.zsh.inc'; fi

timeclaude() {
  local start=$EPOCHREALTIME
  expect -c 'spawn claude; expect -re {❯}; exit' > /dev/null 2>&1
  printf '%.0f\n' $(( (EPOCHREALTIME - start) * 1000 ))
}
