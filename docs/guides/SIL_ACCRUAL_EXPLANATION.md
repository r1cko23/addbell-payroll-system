# SIL Credits Accrual System Explanation

## Overview

The Service Incentive Leave (SIL) accrual system automatically calculates and manages employee leave credits based on their hire date and tenure. The system uses three key fields to track SIL credits:

- **`sil_credits`**: Current available SIL credits (numeric, can be decimal)
- **`sil_balance_year`**: The calendar year this balance applies to (integer, e.g., 2025)
- **`sil_last_accrual`**: The last date when credits were accrued (date)

## How It Works

### 1. Annual Reset (Year Change)

**When**: At the start of each calendar year (January 1st)

**What happens**:
- If `sil_balance_year` is different from the current year, the system resets:
  - `sil_credits` → set to `0`
  - `sil_last_accrual` → set to `NULL`
  - `sil_balance_year` → updated to current year

**Example**:
- Employee has 8.5 SIL credits in 2024
- On January 1, 2025: credits reset to 0, `sil_balance_year` becomes 2025

### 2. First Year Anniversary Grant

**When**: Employee reaches their 1-year anniversary (hire_date + 1 year)

**What happens**:
- If the anniversary falls in the current calendar year:
  - Employee receives a **one-time grant of 10 full SIL days**
  - `sil_last_accrual` is set to the current date
  - Credits are capped at 10 days maximum

**Example**:
- Employee hired: November 16, 2024
- First anniversary: November 16, 2025
- On November 16, 2025: Employee receives 10 SIL credits
- These credits are valid until December 31, 2025

### 3. Subsequent Years Monthly Accrual

**When**: After the first anniversary, in subsequent calendar years

**What happens**:
- Employee accrues **10/12 ≈ 0.8333 credits per month**
- Accrual happens automatically when the function is called
- Credits accumulate monthly from January 1st of each year
- Maximum cap: 10 days per calendar year

**Calculation**:
```
months_to_accrue = (current_year - last_accrual_year) * 12 + (current_month - last_accrual_month)
new_credits = MIN(10, current_credits + (months_to_accrue * 0.8333))
```

**Example**:
- Employee hired: January 27, 2020 (past first anniversary)
- Current date: December 1, 2025
- Last accrual: December 1, 2024
- Months to accrue: 12 months (Dec 2024 to Dec 2025)
- New credits: MIN(10, 0 + (12 * 0.8333)) = 10.0 credits

### 4. Before First Anniversary

**When**: Employee has been with company less than 1 year

**What happens**:
- No SIL credits are accrued
- Employee must wait until their 1-year anniversary to start accruing

## Key Fields Explained

### `sil_balance_year` (INTEGER)

**Purpose**: Tracks which calendar year the current SIL balance applies to

**Values**:
- `NULL`: Employee hasn't accrued credits yet this year, or needs reset
- `2025`: Current balance is for calendar year 2025

**Why it's needed**: 
- Ensures credits reset properly at year-end
- Prevents confusion when calculating accruals across year boundaries

### `sil_last_accrual` (DATE)

**Purpose**: Tracks when credits were last calculated/accrued

**Values**:
- `NULL`: No accrual has happened yet this year, or year just reset
- `2025-12-01`: Credits were last calculated on December 1, 2025

**Why it's needed**:
- Calculates how many months have passed since last accrual
- Prevents double-accrual if function is called multiple times
- Used to determine monthly accrual amounts

### `sil_credits` (NUMERIC)

**Purpose**: Current available SIL credits

**Values**:
- Can be decimal (e.g., 4.9999, 6.6666, 0.8333)
- Maximum: 10.0 per calendar year
- Minimum: 0.0

**Why decimals**:
- Monthly accrual is 10/12 = 0.8333... (repeating decimal)
- System calculates precisely but may show long decimals
- Frontend typically displays rounded to 2 decimal places

## Common Scenarios

### Scenario 1: New Employee (Less than 1 year)
```
Hire Date: July 7, 2025
Current Date: December 21, 2025
Result: sil_credits = 0 (hasn't reached 1-year anniversary yet)
```

### Scenario 2: First Anniversary Year
```
Hire Date: November 10, 2024
First Anniversary: November 10, 2025
Current Date: December 10, 2025
Result: sil_credits = 10.0 (received full 10 days on anniversary)
sil_last_accrual = 2025-12-10
```

### Scenario 3: Long-term Employee (Multiple Years)
```
Hire Date: April 8, 2024
First Anniversary: April 8, 2025 (already passed)
Current Date: December 1, 2025
Last Accrual: December 1, 2024
Months Since Last Accrual: 12 months
Result: sil_credits = 10.0 (12 * 0.8333 = 10.0, capped at 10)
```

### Scenario 4: Mid-Year Check
```
Hire Date: June 24, 2024
First Anniversary: June 24, 2025 (already passed)
Current Date: December 1, 2025
Last Accrual: December 1, 2024
Months Since Last Accrual: 12 months
Result: sil_credits = 10.0
```

### Scenario 5: Year Reset
```
Previous Year: sil_credits = 8.5, sil_balance_year = 2024
Current Date: January 1, 2025
Result: sil_credits = 0, sil_balance_year = 2025, sil_last_accrual = NULL
```

## Function Behavior

The `refresh_employee_leave_balances()` function:

1. **Checks year reset**: If `sil_balance_year` ≠ current year → reset to 0
2. **Checks anniversary**: If employee reached 1-year mark → grant 10 credits (if not already granted)
3. **Calculates monthly accrual**: If past first anniversary → accrue monthly credits
4. **Updates database**: Saves calculated values back to employees table
5. **Returns credits**: Returns current SIL, maternity, and paternity credits

## Important Notes

1. **Credits expire**: SIL credits reset to 0 at the start of each calendar year
2. **Use it or lose it**: Employees should use their credits before December 31st
3. **Maximum cap**: Cannot exceed 10 days per calendar year
4. **Automatic calculation**: Credits are calculated automatically when `get_employee_leave_credits()` is called
5. **Precision**: Decimals are normal due to monthly accrual calculation (10/12 = 0.8333...)

## Database Schema

```sql
employees (
  id UUID PRIMARY KEY,
  hire_date DATE,
  sil_credits NUMERIC DEFAULT 0,
  sil_balance_year INT,
  sil_last_accrual DATE,
  ...
)
```

## Related Functions

- `get_employee_leave_credits(UUID)`: Returns current leave credits (calls refresh function)
- `refresh_employee_leave_balances(UUID)`: Calculates and updates SIL accrual
