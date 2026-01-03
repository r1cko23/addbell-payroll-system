#!/bin/bash
# Script to remove trailing whitespace and final newlines from files

echo "Cleaning whitespace from files..."

# Find all text files and remove trailing whitespace and final newlines
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" -o -name "*.sql" \) \
  ! -path "./node_modules/*" \
  ! -path "./.git/*" \
  ! -path "./.next/*" \
  -exec sh -c '
    for file do
      # Remove trailing whitespace
      sed -i "" "s/[[:space:]]*$//" "$file"
      # Remove final newline if it exists
      perl -pi -e "chomp if eof" "$file" 2>/dev/null || true
    done
  ' sh {} +

echo "Done cleaning whitespace!"

