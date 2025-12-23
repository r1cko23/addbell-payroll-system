#!/bin/bash

# Script to regenerate all attendance records using the API endpoint
# This ensures all records use the corrected logic:
# - Saturday counts as 8 hours even without time log
# - Partial hours are floored down
# - Full cutoff totals 104 hours (13 days * 8 hours) if no absences

BASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:3000}"
API_ENDPOINT="/api/timesheet/auto-generate"

# Get periods from 2024-01-01 to current date
# Each cutoff is 15 days (1-15 and 16-end of month)

echo "Regenerating all attendance records..."
echo "This will update all attendance records with corrected calculation logic."
echo ""

# Note: This script requires authentication. You'll need to:
# 1. Log in to the application
# 2. Get your session cookie
# 3. Run this script with the cookie

# For now, we'll use a direct database approach via SQL
echo "Please run the SQL migration instead, or use the admin interface to regenerate records."

