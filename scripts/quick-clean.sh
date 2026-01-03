#!/bin/bash
# Quick script to restore whitespace changes
# Usage: ./scripts/quick-clean.sh

echo "🧹 Cleaning whitespace changes..."
git restore . 2>/dev/null
echo "✅ Done! Run 'git status' to verify."

