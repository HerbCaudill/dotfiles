# Node comes from Nix. Proto only puts its pinned tools on PATH inside repos
# with a .prototools file, such as DXOS. Proto's own hook never removes its
# entries when you leave such a repo, so this one clears the block it marks
# with activate-start and activate-stop before activating again.
_proto_activate() {
  local dir
  local -i skip=0
  local -a kept
  for dir in $path; do
    if [[ $dir == $PROTO_HOME/activate-start ]]; then
      skip=1
    elif [[ $dir == $PROTO_HOME/activate-stop ]]; then
      skip=0
    elif (( ! skip )); then
      kept+=$dir
    fi
  done
  path=($kept)
  if [[ -n $_PROTO_ACTIVATED_ENV ]]; then
    unset ${(s:,:)_PROTO_ACTIVATED_ENV} _PROTO_ACTIVATED_ENV _PROTO_ACTIVATED_PATH
  fi
  eval "$(proto activate zsh --config-mode upwards --no-bin --no-shim --export 2>/dev/null)"
}

if command -v proto >/dev/null; then
  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd _proto_activate
  _proto_activate
fi
