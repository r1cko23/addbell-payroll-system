# SIL Crediting Logic - CORRECTED Implementation

## Current Date: December 20, 2025

## Corrected Logic

### Key Rules

1. **Annual Reset**: Credits reset to 0 on January 1st of each calendar year (regardless of tenure)

2. **Less than 1 Year (Before First Anniversary)**:
   - Accrue **0.8333 credits** on the **SAME DAY OF THE MONTH** as hire date
   - First accrual: One month after hire date (same day)
   - Example: Hired **August 20, 2025**
     - First accrual: **September 20, 2025** (+0.8333)
     - Second accrual: **October 20, 2025** (+0.8333)
     - Third accrual: **November 20, 2025** (+0.8333)
     - Fourth accrual: **December 20, 2025** (+0.8333)
     - Total: ~3.33 credits by Dec 20, 2025
     - Continues until **August 20, 2026** (first anniversary)

3. **More than 1 Year (After First Anniversary)**:
   - Accrue **0.8333 credits** on the **1st of each month** (starting January 1st)
   - Example: Hired **May 10, 2015** (past first anniversary)
     - Accrual dates: **Jan 1, Feb 1, Mar 1, Apr 1, May 1, Jun 1, Jul 1, Aug 1, Sep 1, Oct 1, Nov 1, Dec 1**
     - Total: 12 months × 0.8333 = **10 credits** (capped at 10)

## Examples

### Example 1: Employee Less Than 1 Year
```
Hire Date: August 20, 2025
First Anniversary: August 20, 2026
Current Date: December 20, 2025

Accrual Schedule:
- Sep 20, 2025: +0.8333 credits (total: 0.8333)
- Oct 20, 2025: +0.8333 credits (total: 1.6666)
- Nov 20, 2025: +0.8333 credits (total: 2.4999)
- Dec 20, 2025: +0.8333 credits (total: 3.3332)

Result: ~3.33 credits
```

### Example 2: Employee More Than 1 Year
```
Hire Date: May 10, 2015
First Anniversary: May 10, 2016 (past)
Current Date: December 20, 2025

Accrual Schedule (on 1st of each month):
- Jan 1, 2025: +0.8333 credits
- Feb 1, 2025: +0.8333 credits
- Mar 1, 2025: +0.8333 credits
- Apr 1, 2025: +0.8333 credits
- May 1, 2025: +0.8333 credits
- Jun 1, 2025: +0.8333 credits
- Jul 1, 2025: +0.8333 credits
- Aug 1, 2025: +0.8333 credits
- Sep 1, 2025: +0.8333 credits
- Oct 1, 2025: +0.8333 credits
- Nov 1, 2025: +0.8333 credits
- Dec 1, 2025: +0.8333 credits

Result: 12 × 0.8333 = 10 credits (capped)
```

### Example 3: Employee Hired Mid-Year (Less Than 1 Year)
```
Hire Date: November 10, 2025
First Anniversary: November 10, 2026
Current Date: December 20, 2025

Accrual Schedule:
- Dec 10, 2025: +0.8333 credits (first accrual, one month after hire)

Result: ~0.83 credits
```

## Edge Cases

### Edge Case 1: Hire Date Day Doesn't Exist in Next Month
**Example**: Hired January 31, 2025
- Next accrual would be February 31 (doesn't exist)
- **Solution**: Accrue on last day of February (Feb 28 or Feb 29)

### Edge Case 2: Reset on January 1
**Example**: Employee has 8.5 credits on Dec 31, 2025
- **January 1, 2026**: Credits reset to 0
- Accrual starts fresh:
  - If < 1 year: Continue on hire date day
  - If > 1 year: Start accruing on Jan 1, 2026

## Summary Table

| Tenure Status | Accrual Day | Accrual Amount | Example |
|--------------|-------------|----------------|---------|
| **Less than 1 year** | Same day of month as hire date | 0.8333/month | Hired Aug 20 → Accrue on 20th |
| **More than 1 year** | 1st of each month | 0.8333/month | Always on 1st |
| **Reset** | January 1st | Reset to 0 | All employees |

## Implementation Notes

- **Monthly accrual rate**: 10/12 = 0.8333... (repeating decimal)
- **Maximum cap**: 10 credits per calendar year
- **Reset timing**: Always January 1st, regardless of tenure
- **Accrual timing**: Based on tenure status (hire date day vs 1st of month)

