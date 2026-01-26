# Show sprite name if in a sprite environment
sprite_prompt_info() {
  if [[ -n "$SPRITE_NAME" ]]; then
    echo "%F{135}{$SPRITE_NAME}%f "
  fi
}

# Different prompt character for sprites vs local
prompt_char() {
  if [[ -n "$SPRITE_NAME" ]]; then
    echo "%F{135}👾 →%f"
  else
    echo "⚡︎"
  fi
}

PROMPT='
$(sprite_prompt_info)%{$fg[cyan]%}%~%{$reset_color%} $(git_prompt_info)
$(prompt_char) '

ZSH_THEME_GIT_PROMPT_PREFIX="%{$fg[green]%}"
ZSH_THEME_GIT_PROMPT_SUFFIX="%{$reset_color%} "
ZSH_THEME_GIT_PROMPT_DIRTY="%1{*%}"
ZSH_THEME_GIT_PROMPT_CLEAN=""
