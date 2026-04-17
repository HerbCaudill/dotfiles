prompt_char() {
  echo "⚡︎"
}

PROMPT='
%{$fg[cyan]%}%~%{$reset_color%} $(git_prompt_info)
$(prompt_char) '

ZSH_THEME_GIT_PROMPT_PREFIX="%{$fg[green]%}"
ZSH_THEME_GIT_PROMPT_SUFFIX="%{$reset_color%} "
ZSH_THEME_GIT_PROMPT_DIRTY="%1{*%}"
ZSH_THEME_GIT_PROMPT_CLEAN=""
