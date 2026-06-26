#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Sync Zoom transcripts
# @raycast.mode silent
# @raycast.icon 📝
# @raycast.packageName Meetings
# @raycast.description Import and process the latest Zoom transcripts

osascript -e '
tell application "iTerm"
    create window with default profile
    tell current session of current window
        write text "cd /Users/herbcaudill/Code/HerbCaudill/zoom-transcripts && clear && pnpm sync"
    end tell
    tell current window
        set bounds to {100, 100, 1400, 900}
    end tell
end tell'
