# Test Scripts

## Time Clock Test Script

Automatically record a full 8-hour shift (or custom hours) for employee time in/out testing.

### Quick Start

```bash
# Record an 8-hour shift starting now
npm run test:clock -- --employee-id 2014-027

# Record an 8-hour shift starting at a specific time
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00"

# Record a 10-hour shift
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00" --hours 10

# Record with specific clock in and out times
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00" --end-time "2025-01-15 17:00:00"
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--employee-id` | `-e` | Employee ID (e.g., "2014-027") - **REQUIRED** | - |
| `--start-time` | `-s` | Clock in time (format: "YYYY-MM-DD HH:mm:ss") | Current time |
| `--end-time` | `-t` | Clock out time (format: "YYYY-MM-DD HH:mm:ss") | start-time + 8 hours |
| `--hours` | `-h` | Number of hours to work | 8 |
| `--location` | `-l` | Location coordinates "lat,lng" | First office location |
| `--notes` | `-n` | Optional notes for the entry | - |

### Examples

#### Basic Usage
```bash
# Clock in now, clock out 8 hours later
npm run test:clock -- -e 2014-027
```

#### Specific Time
```bash
# Clock in at 8 AM, work 8 hours (clocks out at 5 PM)
npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00"
```

#### Custom Hours
```bash
# Work 10 hours instead of 8
npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00" -h 10
```

#### Exact Times
```bash
# Clock in at 8 AM, clock out at 6 PM
npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00" -t "2025-01-15 18:00:00"
```

#### With Custom Location
```bash
# Use custom GPS coordinates
npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00" -l "14.5995,120.9842"
```

#### With Notes
```bash
# Add notes to the entry
npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00" -n "Test entry for demo"
```

### Date Formats Supported

- `YYYY-MM-DD HH:mm:ss` - Full datetime (e.g., "2025-01-15 08:00:00")
- `YYYY-MM-DD HH:mm` - Date and time without seconds (e.g., "2025-01-15 08:00")
- `YYYY-MM-DD` - Date only (defaults to 8:00 AM)
- `MM/DD/YYYY HH:mm:ss` - US format (e.g., "01/15/2025 08:00:00")
- `MM/DD/YYYY HH:mm` - US format without seconds

### How It Works

1. **Finds Employee**: Looks up the employee by `employee_id` in the database
2. **Gets Location**: Uses the first office location from `office_locations` table (or default Manila coordinates)
3. **Creates Entry**: Inserts a complete time clock entry with clock in and clock out times
4. **Auto-Calculates**: Database triggers automatically calculate:
   - Total hours
   - Regular hours (capped at 8)
   - Overtime hours
   - Night differential hours
   - Status (auto-approved)

### Output

The script will display:
- ✅ Employee found confirmation
- 📋 Entry details (times, hours, location)
- ✅ Success confirmation with entry ID
- 📊 Calculated hours breakdown
- ✨ Completion message

### Troubleshooting

**Error: Employee not found**
- Make sure the employee ID exists in the database
- Check that the employee is active (`is_active = true`)

**Error: Missing Supabase credentials**
- Ensure `.env.local` file exists with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Error: Invalid date format**
- Use one of the supported date formats listed above
- Make sure dates are in the future (or past if testing historical data)

### Use Cases

- **Testing**: Quickly create test data for time clock functionality
- **Demo Data**: Generate sample entries for presentations
- **Development**: Test timesheet calculations and overtime logic
- **QA**: Verify time clock triggers and calculations work correctly

