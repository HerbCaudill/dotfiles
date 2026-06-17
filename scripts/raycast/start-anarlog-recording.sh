#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Start anarlog recording
# @raycast.mode silent
# @raycast.icon 🎙️
# @raycast.packageName Meetings

osascript <<'APPLESCRIPT'
set appId to "com.hyprnote.stable"

tell application id appId to activate

tell application "System Events"
  repeat 100 times
    if exists application process whose bundle identifier is appId then
      set anarlogProcess to first application process whose bundle identifier is appId
      if frontmost of anarlogProcess then exit repeat
      set frontmost of anarlogProcess to true
    end if

    delay 0.1
  end repeat

  delay 0.2
  keystroke "n" using {command down, shift down}
end tell
APPLESCRIPT
