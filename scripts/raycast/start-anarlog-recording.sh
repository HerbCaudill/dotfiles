#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Start anarlog recording
# @raycast.mode silent
# @raycast.icon 🎙️
# @raycast.packageName Meetings

if pgrep -x "anarlog" >/dev/null; then
  startup_delay=0.2
else
  startup_delay=3
fi

osascript "$startup_delay" <<'APPLESCRIPT'
on run argv
  set startupDelay to item 1 of argv as real

  tell application "anarlog" to activate

  tell application "System Events"
    repeat 100 times
      if exists process "anarlog" then
        tell process "anarlog" to set frontmost to true
        if frontmost of process "anarlog" then exit repeat
      end if

      delay 0.1
    end repeat

    delay startupDelay
    keystroke "n" using {command down, shift down}
  end tell
end run
APPLESCRIPT
