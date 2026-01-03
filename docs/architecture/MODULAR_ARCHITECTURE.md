# Modular Monolithic Architecture Guide

## Overview

This document outlines the recommended modular monolithic architecture for GP-HRIS.
The goal is to organize code by **business domain** while keeping deployment simple.

## Current vs Proposed Structure

### Current (Flat)

```
app/
├── payslips/page.tsx
├── timesheet/page.tsx
├── employees/page.tsx
lib/
├── timekeeper.ts
├── overtimeHelper.ts
utils/
├── payroll-calculator.ts
├── ph-deductions.ts
```

### Proposed (Modular)

```
src/
├── modules/
│   ├── payroll/                    # Payroll Domain
│   │   ├── api/
│   │   │   └── payslip.api.ts
│   │   ├── components/
│   │   │   ├── PayslipPrint.tsx
│   │   │   └── PayslipBreakdown.tsx
│   │   ├── hooks/
│   │   │   └── usePayslip.ts
│   │   ├── services/
│   │   │   ├── payroll-calculator.ts
│   │   │   └── deductions.ts
│   │   ├── types/
│   │   │   └── payroll.types.ts
│   │   └── index.ts                # Public exports only
│   │
│   ├── attendance/                 # Attendance Domain
│   │   ├── api/
│   │   │   └── time-clock.api.ts
│   │   ├── components/
│   │   │   └── TimesheetTable.tsx
│   │   ├── hooks/
│   │   │   └── useTimesheet.ts
│   │   ├── services/
│   │   │   ├── timekeeper.ts
│   │   │   └── night-diff.ts
│   │   ├── types/
│   │   │   └── attendance.types.ts
│   │   └── index.ts
│   │
│   ├── employees/                  # Employee Domain
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── index.ts
│   │
│   ├── leave/                      # Leave Management Domain
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── index.ts
│   │
│   └── auth/                       # Authentication Domain
│       ├── api/
│       ├── hooks/
│       ├── services/
│       └── index.ts
│
├── shared/                         # Shared utilities
│   ├── components/
│   │   └── ui/                     # shadcn components
│   ├── hooks/
│   │   └── useSupabase.ts
│   ├── lib/
│   │   ├── supabase/
│   │   └── api-utils.ts
│   └── types/
│       └── database.ts
│
└── app/                            # Next.js App Router (thin layer)
    ├── (dashboard)/
    │   ├── payslips/page.tsx       # Just imports from modules
    │   ├── timesheet/page.tsx
    │   └── employees/page.tsx
    ├── (employee-portal)/
    │   └── ...
    └── api/
        └── ...                     # Thin API routes calling module services
```

## Module Rules

### 1. Encapsulation

Each module exposes only what's needed via `index.ts`:

```typescript
// modules/payroll/index.ts
export { PayslipPrint } from "./components/PayslipPrint";
export { usePayslip } from "./hooks/usePayslip";
export { calculatePayroll } from "./services/payroll-calculator";
export type { Payslip, PayrollBreakdown } from "./types/payroll.types";

// Internal services stay private
// ❌ Don't export: ./services/internal-helpers.ts
```

### 2. Dependencies Flow

```
app/ → modules/ → shared/
         ↓
     modules can depend on other modules via their public API
```

**Allowed:**

```typescript
// modules/payroll/services/payroll-calculator.ts
import { getAttendanceData } from "@/modules/attendance";
```

**Not Allowed:**

```typescript
// modules/payroll/services/payroll-calculator.ts
import { internalHelper } from "@/modules/attendance/services/internal";
```

### 3. Shared Code

Put truly shared code in `/shared`:

- UI components (shadcn)
- Database types
- Supabase client
- Common utilities (formatCurrency, etc.)

## Benefits

### 1. **Scalability**

- Add new modules without affecting others
- Team members can own specific modules
- Clear boundaries prevent spaghetti code

### 2. **Testability**

- Test modules in isolation
- Mock module dependencies easily
- Faster test execution

### 3. **Maintainability**

- Find related code easily
- Changes are localized
- Clear ownership

### 4. **Future-Proofing**

- Easy to extract to microservices later
- Can deploy modules separately if needed
- Database can be split per module

## Migration Strategy

### Phase 1: Create Module Structure (Low Risk)

1. Create `/modules` and `/shared` directories
2. Move shared components to `/shared`
3. Keep everything else working

### Phase 2: Extract Payroll Module (Medium Risk)

1. Move payroll-related files to `/modules/payroll`
2. Create public exports in `index.ts`
3. Update imports in app pages

### Phase 3: Extract Remaining Modules

1. Attendance module
2. Employees module
3. Leave module
4. Auth module

### Phase 4: Enforce Module Boundaries

1. Add ESLint rules to prevent cross-module imports
2. Add dependency-cruiser for visualization
3. Document module APIs

## Example: Payroll Module

```typescript
// modules/payroll/index.ts
// Public API - only these exports are allowed to be imported by other modules

// Components
export { PayslipPrint } from "./components/PayslipPrint";
export { PayslipDetailedBreakdown } from "./components/PayslipDetailedBreakdown";

// Hooks
export { usePayslip } from "./hooks/usePayslip";
export { usePayrollCalculation } from "./hooks/usePayrollCalculation";

// Services (for server-side use)
export { calculateWeeklyPayroll } from "./services/payroll-calculator";
export {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
} from "./services/ph-deductions";

// Types
export type {
  Payslip,
  PayrollBreakdown,
  Deductions,
  EarningsBreakdown,
} from "./types/payroll.types";
```

```typescript
// modules/payroll/hooks/usePayslip.ts
import { useCallback, useState } from "react";
import { useSupabase } from "@/shared/hooks/useSupabase";
import { calculateWeeklyPayroll } from "../services/payroll-calculator";
import type { Payslip } from "../types/payroll.types";

export function usePayslip(employeeId: string, periodStart: Date) {
  const supabase = useSupabase();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(false);

  const generatePayslip = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch attendance from attendance module
      const { getAttendanceForPeriod } = await import("@/modules/attendance");
      const attendance = await getAttendanceForPeriod(employeeId, periodStart);

      // Calculate payroll
      const payroll = calculateWeeklyPayroll(attendance, ratePerHour);

      // Save to database
      const { data, error } = await supabase
        .from("payslips")
        .insert(payroll)
        .single();

      if (error) throw error;
      setPayslip(data);
    } finally {
      setLoading(false);
    }
  }, [employeeId, periodStart, supabase]);

  return { payslip, loading, generatePayslip };
}
```

## ESLint Configuration

Add to `.eslintrc.js` to enforce module boundaries:

```javascript
module.exports = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/modules/*/services/*", "@/modules/*/components/*"],
            message:
              "Import from module index.ts instead: @/modules/moduleName",
          },
        ],
      },
    ],
  },
};
```

## When to Consider Microservices

Move to microservices when:

- [ ] Team grows beyond 10 developers
- [ ] Need independent deployment per module
- [ ] Different scaling requirements per module
- [ ] Regulatory requirements for data isolation
- [ ] Multiple applications sharing same backend

Until then, modular monolithic gives you 80% of the benefits with 20% of the complexity.








