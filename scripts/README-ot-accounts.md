# Import OT Approver/Viewer Accounts from Excel

This script imports OT approver and viewer accounts from an Excel file.

## Prerequisites

1. Excel file with the following columns (headers in first row):
   - **Full Name** (Column A) - User's full name (email will be auto-generated)
   - **Password** (Column B) - Password (minimum 8 characters)
   - **Role** (Column C) - Either `ot_approver` or `ot_viewer`

2. Environment variables set in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Excel File Format

The script expects an Excel file with the following structure:

| Full Name | Password | Role |
|-----------|----------|------|
| John Doe | password123 | ot_approver |
| Jane Smith | password456 | ot_viewer |

**Notes:**
- First row should contain headers (Full Name, Password, Role)
- Data starts from row 2
- **Email is auto-generated** as `firstnamelastname@greenpasture.ph` (all lowercase)
  - Example: "John Doe" → `johndoe@greenpasture.ph`
  - Example: "Maria Santos" → `mariasantos@greenpasture.ph`
- Column names are case-insensitive (e.g., "Full Name", "full name", "FULL NAME" all work)
- Role can be: `ot_approver`, `ot_viewer`, `approver`, or `viewer`
- Password must be at least 8 characters long
- If columns aren't found by name, script uses position (A=Full Name, B=Password, C=Role)
- Full name must contain at least first name and last name (separated by space)

## Usage

### Basic Usage

```bash
node scripts/import-ot-accounts-from-excel.js path/to/your/file.xlsx
```

### Dry Run (Preview Changes)

```bash
node scripts/import-ot-accounts-from-excel.js path/to/your/file.xlsx --dry-run
```

### Default Location

If no file path is provided, script looks for `data/ot-accounts.xlsx`:

```bash
node scripts/import-ot-accounts-from-excel.js
```

## What the Script Does

1. Reads the Excel file
2. Validates each row (email format, password length, role validity)
3. Checks for existing accounts (skips duplicates)
4. Creates accounts in Supabase Auth
5. Creates user records in the `users` table
6. Reports summary of created/skipped/errors

## Example Output

```
================================================================================
OT APPROVER/VIEWER ACCOUNTS IMPORT FROM EXCEL
================================================================================

Excel file: data/ot-accounts.xlsx
Total accounts in Excel: 5

Fetching existing users from database...
Found 10 existing users in database

Starting account creation process...

+ Created: John Doe (approver1@example.com) - Role: ot_approver
+ Created: Jane Smith (viewer1@example.com) - Role: ot_viewer
⊘ Skipped (already exists): Bob Johnson (bob@example.com)

================================================================================
IMPORT SUMMARY
================================================================================
Total accounts in Excel: 5
Created: 4
Skipped (already exist): 1
Errors: 0

================================================================================
Import completed!
================================================================================
```

## Error Handling

- **Duplicate emails**: Automatically skipped (not created)
- **Invalid passwords**: Row skipped with warning
- **Invalid roles**: Row skipped with warning
- **Missing required fields**: Row skipped
- **Auth creation failures**: Error logged, user not created
- **Database insert failures**: Auth user cleaned up automatically

## Notes

- Accounts are created with `email_confirm: true` (no email verification needed)
- All accounts are set to `is_active: true` by default
- Passwords are stored securely in Supabase Auth
- The script uses service role key to bypass RLS policies

