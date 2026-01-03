#!/bin/bash
# Show git status but filter out whitespace-only changes

git status --short | while read status file; do
  if [ -n "$file" ] && [ -f "$file" ]; then
    # Check if the diff has any non-whitespace changes
    diff_output=$(git diff --ignore-all-space --ignore-blank-lines "$file" 2>/dev/null)
    if [ -n "$diff_output" ]; then
      echo "$status $file"
    fi
  else
    # Show untracked files and other status
    echo "$status $file"
  fi
done

