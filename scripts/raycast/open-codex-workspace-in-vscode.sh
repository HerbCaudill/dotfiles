#!/bin/zsh

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Codex workspace in VS Code
# @raycast.mode silent
# @raycast.packageName Developer Utils

# Optional parameters:
# @raycast.icon 🟦
# @raycast.description Open the active Codex task's working directory in VS Code

osascript <<'APPLESCRIPT'
set savedClipboard to the clipboard as record
set marker to "codex-workspace-pending-" & (random number from 100000 to 999999)
set workspacePath to marker

try
  tell application "System Events"
    set frontProcess to first application process whose frontmost is true
    if bundle identifier of frontProcess is not "com.openai.codex" then error number -128
  end tell

  set the clipboard to marker

  tell application "System Events"
    keystroke "c" using {command down, shift down}
  end tell

  repeat 20 times
    delay 0.05
    set workspacePath to the clipboard as text
    if workspacePath is not marker then exit repeat
  end repeat

  set the clipboard to savedClipboard

  if workspacePath is marker then error "Codex did not provide a working directory."

  set quotedWorkspacePath to quoted form of workspacePath
  do shell script "test -d " & quotedWorkspacePath & " && /usr/local/bin/code --reuse-window " & quotedWorkspacePath
on error errorMessage number errorNumber
  set the clipboard to savedClipboard
  if errorNumber is not -128 then error errorMessage number errorNumber
end try
APPLESCRIPT
