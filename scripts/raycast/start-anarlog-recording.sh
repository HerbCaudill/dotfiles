#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Start anarlog recording
# @raycast.mode silent
# @raycast.icon 🎙️
# @raycast.packageName Meetings

osascript <<'APPLESCRIPT'
tell application "anarlog" to activate

tell application "System Events"
  repeat 100 times
    if exists process "anarlog" then
      tell process "anarlog" to set frontmost to true
      delay 0.1
      if frontmost of process "anarlog" then exit repeat
    end if

    delay 0.1
  end repeat

  keystroke "n" using {command down, shift down}
end tell
APPLESCRIPT
