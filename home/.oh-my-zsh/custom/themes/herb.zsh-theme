# Show sprite name if in a sprite environment
sprite_prompt_info() {
  if [[ "$HOME" == "/home/sprite" ]]; then
    echo "%{$fg[magenta]%}[$(hostname)]%{$reset_color%} "
  fi
}

PROMPT='
$(sprite_prompt_info)%{$fg[cyan]%}%c%{$reset_color%} $(git_prompt_info)
⚡︎ '

ZSH_THEME_GIT_PROMPT_PREFIX="%{$fg[green]%}"
ZSH_THEME_GIT_PROMPT_SUFFIX="%{$reset_color%} "
ZSH_THEME_GIT_PROMPT_DIRTY="%1{*%}"
ZSH_THEME_GIT_PROMPT_CLEAN=""

