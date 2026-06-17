#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Start anarlog recording
# @raycast.mode silent
# @raycast.icon 🎙️
# @raycast.packageName Meetings

osascript <<'APPLESCRIPT'
tell application "anarlog" to activate
delay 0.4
tell application "System Events"
  keystroke "n" using {command down, shift down}
end tell
APPLESCRIPT
