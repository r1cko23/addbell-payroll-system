# Rest Day Pay Rules

## Overview

Rest days are **NOT PAID** if employees do not work on them. Rest day pay is only given when employees actually work on their designated rest day.

## Office-Based Employees

### Rest Day
- **Designated Rest Day:** Sunday
- **Pay Rule:** **NOT PAID** if not worked
- **If Worked:** Paid at 1.3x rate (30% premium) for Rank and File employees

### Regular Work Days
- **Monday to Saturday:** Paid based on clock entries
- **Saturday:** Gets 8 BH even if not worked (regular work day per Philippine labor law)
- **Sunday:** Rest day - NOT PAID if not worked

### Example
- Employee doesn't work on Sunday: **No pay**
- Employee works 8 hours on Sunday: **8 hours × rate/hour × 1.3 = Rest day pay**

## Client-Based Employees (Account Supervisors)

### Rest Day
- **Designated Rest Day:** Monday, Tuesday, or Wednesday (only 1 day per week)
- **Pay Rule:** **NOT PAID** if not worked
- **If Worked:** Paid at 1.0x rate (daily rate) + allowance (if ≥4 hours worked)

### Regular Work Days
- **6 days per week** (excluding the 1 rest day)
- **Must have clock entries** to be paid
- **No automatic 8 BH** - must log time to be paid

### Example
- Employee's rest day is Monday: **Monday is NOT PAID if not worked**
- Employee works 8 hours on Monday (rest day): **8 hours × rate/hour × 1.0 = Rest day pay + allowance**
- Employee doesn't log on Tuesday: **ABSENT** (no pay)

## Implementation

### Files Updated
1. `components/PayslipDetailedBreakdown.tsx` - Removed automatic 8 hours rest day pay
2. `components/PayslipPrint.tsx` - Removed automatic 8 hours rest day pay
3. `lib/timesheet-auto-generator.ts` - Removed "second rest day" logic

### Key Changes
- **Before:** Rank and File employees got automatic 8 hours rest day pay even if not worked
- **After:** Rest day pay only given if `regularHours > 0` (employee actually worked)

### Code Logic

```typescript
// Rest Day Pay - Only if worked
if (dayType === "sunday" && regularHours > 0) {
  // Calculate rest day pay with multiplier
  breakdown.restDay.hours += regularHours;
  breakdown.restDay.amount += calculateSundayRestDay(regularHours, ratePerHour);
}
// If regularHours === 0, no rest day pay
```

## Saturday Logic (Unchanged)

- **Office-based:** Saturday gets 8 BH even if not worked (regular work day)
- **Client-based:** Saturday is normal workday - must have clock entries to be paid

## Summary

| Employee Type | Rest Day | Rest Day Pay | Saturday Pay |
|---------------|----------|--------------|--------------|
| **Office-based** | Sunday | Only if worked | 8 BH even if not worked |
| **Client-based** | Mon/Tue/Wed (1 day) | Only if worked | Only if clocked in |