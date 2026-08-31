#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open secrets
# @raycast.mode silent
# @raycast.packageName Developer Utils

# Optional parameters:
# @raycast.icon 🔐
# @raycast.description Open ~/.secrets in VS Code

code --reuse-window "$HOME/.secrets"
