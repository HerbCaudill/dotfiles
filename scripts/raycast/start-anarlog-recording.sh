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
      tell process "anarlog"
        if frontmost and exists menu bar 1 then exit repeat
      end tell
    end if

    delay 0.1
  end repeat

  tell process "anarlog" to set frontmost to true
  keystroke "n" using {command down, shift down}
end tell
APPLESCRIPT
