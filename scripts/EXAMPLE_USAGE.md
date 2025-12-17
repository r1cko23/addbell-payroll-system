# Time Clock Test Script - Example Usage

## Quick Examples

### Example 1: Record Today's 8-Hour Shift
```bash
npm run test:clock -- --employee-id 2014-027
```
This will:
- Clock in at the current time
- Clock out 8 hours later
- Use the office location from database

### Example 2: Record Yesterday's Shift
```bash
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-14 08:00:00"
```
This will:
- Clock in at 8:00 AM yesterday
- Clock out at 5:00 PM yesterday (8 hours later)

### Example 3: Record Multiple Days
```bash
# Monday
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-13 08:00:00"

# Tuesday
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-14 08:00:00"

# Wednesday
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00"
```

### Example 4: Record Overtime (10 Hours)
```bash
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00" --hours 10
```
This will:
- Clock in at 8:00 AM
- Clock out at 6:00 PM (10 hours later)
- Regular hours: 8
- Overtime hours: 2 (requires HR approval)

### Example 5: Record Night Shift
```bash
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 22:00:00" --hours 8
```
This will:
- Clock in at 10:00 PM
- Clock out at 6:00 AM next day
- Night differential hours will be calculated automatically

### Example 6: Record with Notes
```bash
npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00" --notes "Test entry for demo purposes"
```

## Batch Recording Script

Create a file `record-week.sh`:

```bash
#!/bin/bash
EMPLOYEE_ID="2014-027"
START_DATE="2025-01-13" # Monday

for i in {0..4}; do
  DATE=$(date -j -v+${i}d -f "%Y-%m-%d" "${START_DATE}" "+%Y-%m-%d" 2>/dev/null || date -d "${START_DATE} +${i} days" "+%Y-%m-%d")
  echo "Recording shift for ${DATE}..."
  npm run test:clock -- --employee-id "${EMPLOYEE_ID}" --start-time "${DATE} 08:00:00"
  sleep 1
done
```

Make it executable and run:
```bash
chmod +x record-week.sh
./record-week.sh
```

## What Happens After Running

1. ✅ Script finds the employee in the database
2. ✅ Creates a time clock entry with clock in/out times
3. ✅ Database triggers automatically calculate:
   - Total hours worked
   - Regular hours (capped at 8)
   - Overtime hours (if > 8 hours)
   - Night differential hours (if 10 PM - 6 AM)
   - Status (auto-approved for regular hours)
4. ✅ Entry appears in:
   - Employee Portal (`/employee-portal`)
   - Time Entries page (`/time-entries`)
   - Timesheet page (`/timesheet`) - after importing

## Verification

After running the script, verify the entry:

1. **Check Employee Portal**:
   ```
   http://localhost:3000/employee-portal
   ```
   Login with employee credentials and check "This Week's Entries"

2. **Check Time Entries** (HR):
   ```
   http://localhost:3000/time-entries
   ```
   View all time entries and verify hours are calculated correctly

3. **Check Timesheet**:
   ```
   http://localhost:3000/timesheet
   ```
   Click "Import Clock Entries" to sync the time clock entry to the timesheet

## Tips

- **Multiple Employees**: Run the script multiple times with different `--employee-id` values
- **Different Shifts**: Use `--hours` to simulate different shift lengths
- **Historical Data**: Use past dates to create historical entries
- **Testing Overtime**: Use `--hours 10` or `--hours 12` to test overtime approval flow
- **Location Testing**: Use `--location` to test geofencing (use coordinates outside office radius)

