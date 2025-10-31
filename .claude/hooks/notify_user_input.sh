#!/bin/bash
# Claude Code Hook: User Input Notification
# Triggers on Notification event when Claude awaits user input

# Read JSON payload from stdin
INPUT_JSON=$(cat)

# Extract message from JSON (using jq if available, otherwise grep)
if command -v jq &> /dev/null; then
    MESSAGE=$(echo "$INPUT_JSON" | jq -r '.message // "Awaiting your input"')
else
    MESSAGE="Claude Code needs your input"
fi

# Determine platform and send notification
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use osascript for native notification
    osascript -e "display notification \"$MESSAGE\" with title \"Claude Code\" sound name \"Ping\""
elif command -v notify-send &> /dev/null; then
    # Linux with notify-send
    notify-send "Claude Code" "$MESSAGE" -u normal -t 5000
else
    # Fallback: terminal bell + colored message
    echo -e "\a\033[1;33m⚠ Claude Code: $MESSAGE\033[0m" >&2
fi

# Exit 0 to indicate success (non-blocking)
exit 0
