#!/bin/bash

# ==========================================
# Path Resolution (The Fix)
# ==========================================

# 1. Get the directory where this script resides (e.g., /path/to/Project/script)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 2. Get the Project Root (assuming script is inside /script/, so go up one level)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ==========================================
# Configuration Constants
# ==========================================

# Path to the QuickBMS executable
# Using variable to easily switch versions if needed
QBMS_EXE="$PROJECT_ROOT/bin/quickbms_4gb_files.exe"

# The specific BMS script for the game
BMS_SCRIPT="$PROJECT_ROOT/scripts/nizhan-future.bms"

# Input directory containing the .pak files
INPUT_DIR="/e/games/WeGameApps/rail_apps/逆战：未来(2002130)/NZM/Content"

# Output directory for extracted files
OUTPUT_DIR="$PROJECT_ROOT/refs/"

# ==========================================
# Logic Implementation
# ==========================================

# Check if a filter path was provided as an argument
if [ -z "$1" ]; then
    echo "Error: Please provide a filter path."
    echo "Usage example: ./decrypt.sh NZM/Content/AIBehavior"
    exit 1
fi

# Process the filter argument
# Remove trailing slash if present to avoid double slashes, then append /*
# This allows the user to input "Dir" and have it interpreted as "Dir/*"
TARGET_DIR="${1%/}"
FILTER_FLAG="${TARGET_DIR}/*"

echo "----------------------------------------"
echo "Starting QuickBMS execution..."
echo "Filter: $FILTER_FLAG"
echo "Input:  $INPUT_DIR"
echo "Output: $OUTPUT_DIR"
echo "----------------------------------------"

# Execute the command
# -f: Applies the filter logic
# -F: Keeps your original format string "{}.pak"
# We wrap variables in quotes to handle potential spaces in paths
"$QBMS_EXE" -o -f "$FILTER_FLAG" -F "{}.pak" "$BMS_SCRIPT" "$INPUT_DIR" "$OUTPUT_DIR"

echo "Execution complete!"
