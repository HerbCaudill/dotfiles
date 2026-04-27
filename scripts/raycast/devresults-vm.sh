#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title DevResults VS Code
# @raycast.mode silent
# @raycast.packageName Developer Utils

# Optional parameters:
# @raycast.icon 🟠
# @raycast.description Open C:/Code/DevResults in VS Code using Remote-SSH

code --folder-uri "vscode-remote://ssh-remote+devresults-vm/C:/Code/DevResults" >/dev/null 2>&1 &
osascript -e 'tell application "Visual Studio Code" to activate'
