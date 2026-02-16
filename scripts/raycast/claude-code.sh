#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Claude Code
# @raycast.mode silent
# @raycast.icon 🤖

osascript -e '
tell application "iTerm"
    create window with default profile
    tell current session of current window
        write text "cd ~/Code/herbcaudill && cls && cl"
    end tell
    tell current window
        set bounds to {100, 100, 1400, 900}
    end tell
end tell'