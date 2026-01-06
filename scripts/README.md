# Scripts

Utility scripts for the GP-HRIS system.

## Available Scripts

| Script                    | Command                         | Description                      |
| ------------------------- | ------------------------------- | -------------------------------- |
| Import Employees          | `npm run import:employees`      | Import employees from Excel       |
| Import OT Accounts        | `npm run import:ot-accounts`     | Import OT approver/viewer accounts from Excel |
| Test Time Clock           | `npm run test:clock`            | Create test time entries         |

---

## Employee Import

Import and update employees from `data/UPDATED MASTERLIST ORGANIC.xlsx`.

### Usage

```bash
# Dry run (preview changes)
npm run import:employees -- --dry-run

# Actual import
npm run import:employees
```

### Excel Columns

- **EMPLOYEE ID** - Unique identifier (required)
- **LAST NAME**, **FIRST NAME**, **MIDDLE NAME**
- **MONTHLY RATE**, **PER DAY** - Salary rates
- **POSITION**, **JOB LEVEL** - Job info
- **ENTITLEMENT FOR OT** - YES/NO for overtime eligibility
- **BIRTH DATE**, **DATE HIRED** - Dates (YYYY-MM-DD)
- **TIN**, **SSS**, **PHILHEALTH**, **PAGIBIG** - Government IDs
- **STATUS** - Employee status

---

## OT Accounts Import

Import OT approver and viewer accounts from an Excel file.

### Usage

```bash
# Dry run (preview changes)
npm run import:ot-accounts -- path/to/file.xlsx --dry-run

# Actual import
npm run import:ot-accounts -- path/to/file.xlsx

# Use default location (data/ot-accounts.xlsx)
npm run import:ot-accounts
```

### Excel Format

| Full Name | Password | Role |
|-----------|----------|------|
| John Doe | password123 | ot_approver |
| Jane Smith | password456 | ot_viewer |

**Required columns:**
- **Full Name** - User's full name (email auto-generated as `firstnamelastname@greenpasture.ph`)
- **Password** - Minimum 8 characters
- **Role** - `ot_approver` or `ot_viewer`

**Email Format:**
- Automatically generated from full name
- Format: `firstnamelastname@greenpasture.ph` (all lowercase)
- Example: "John Doe" → `johndoe@greenpasture.ph`

See `scripts/README-ot-accounts.md` for detailed documentation.

---

## Time Clock Test

Create test time clock entries for development/testing.

### Usage

```bash
# Basic 8-hour shift starting now
npm run test:clock -- --employee-id 2014-027

# Specific start time
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00"

# Custom hours
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00" --hours 10
```

### Options

| Option          | Short | Description            | Default         |
| --------------- | ----- | ---------------------- | --------------- |
| `--employee-id` | `-e`  | Employee ID (required) | -               |
| `--start-time`  | `-s`  | Clock in time          | Current time    |
| `--end-time`    | `-t`  | Clock out time         | start + 8 hours |
| `--hours`       | `-h`  | Hours to work          | 8               |
| `--location`    | `-l`  | GPS "lat,lng"          | First office    |

---

## Environment Setup

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
