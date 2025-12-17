# Page Refactoring Checklist

This checklist tracks the refactoring progress for each page to use the new UI component system.

## ✅ Completed Pages

### Dashboard Pages

- [x] `app/dashboard/page.tsx` - Wrapper component (uses HRDashboard)
- [x] `app/dashboard/HRDashboard.tsx` - Fully refactored with new component system
- [x] `app/dashboard/AdminDashboard.tsx` - Fully refactored with new component system

### Core Pages

- [x] `app/clock/page.tsx` - Fully refactored with new component system
- [x] `app/schedules/page.tsx` - Fully refactored with new component system
- [x] `app/time-entries/page.tsx` - Fully refactored with new component system
- [x] `app/timesheet/page.tsx` - Fully refactored with new component system
- [x] `app/payslips/page.tsx` - Fully refactored with new component system
- [x] `app/deductions/page.tsx` - Fully refactored with new component system
- [x] `app/settings/page.tsx` - Fully refactored with new component system
- [x] `app/employees/page.tsx` - Fully refactored (icons updated to use Icon component)

### Approval Pages

- [x] `app/leave-approval/page.tsx` - Fully refactored with new component system
- [x] `app/overtime-approval/page.tsx` - Fully refactored with new component system
- [x] `app/failure-to-log-approval/page.tsx` - Fully refactored (icons updated)

### Employee Portal Pages

- [x] `app/employee-portal/bundy/page.tsx` - Fully refactored (icons updated)
- [x] `app/employee-portal/leave-request/page.tsx` - Fully refactored with new component system
- [x] `app/employee-portal/overtime/page.tsx` - Fully refactored with new component system
- [x] `app/employee-portal/schedule/page.tsx` - Fully refactored with new component system
- [x] `app/employee-portal/failure-to-log/page.tsx` - Fully refactored with new component system
- [x] `app/employee-portal/info/page.tsx` - Fully refactored with new component system
- [x] `app/employee-portal/page.tsx` - Redirect only (no refactoring needed)

### Other Pages

- [x] `app/activity/page.tsx` - Fully refactored with new component system
- [x] `app/login/page.tsx` - Simple form page (uses basic HTML, no refactoring needed)
- [x] `app/employee-login/page.tsx` - Redirect only (no refactoring needed)
- [x] `app/reset-password/page.tsx` - Simple form page (uses basic HTML, no refactoring needed)
- [x] `app/page.tsx` - Redirect only (no refactoring needed)

## 🎉 Status: COMPLETE

All pages that require refactoring have been successfully migrated to the new UI component system!

## Refactoring Criteria

For each page, ensure:

- [x] Replace raw HTML headings (`<h1>`, `<h2>`, etc.) with Typography components (`H1`, `H2`, etc.)
- [x] Replace manual flex layouts with `HStack`/`VStack` components
- [x] Replace `Card` + `CardHeader` + `CardContent` with `CardSection` where appropriate
- [x] Replace direct Phosphor icon imports with `Icon` component
- [x] Use consistent spacing scale (`gap-4`, `gap-6`, `gap-8`)
- [x] Replace inline styles with Tailwind classes
- [x] Use `InputGroup` for form fields (where applicable)
- [x] Ensure consistent icon sizes using `IconSizes` enum
- [x] Use consistent icon weight (regular by default)

## Summary

✅ **All refactoring tasks completed!**

All pages have been successfully migrated to use the new UI component system:

- Typography components (`H1`, `H2`, `H3`, `BodySmall`, `Caption`, `Label`)
- Layout components (`HStack`, `VStack`)
- Card components (`CardSection`)
- Icon component (`Icon` with `IconSizes`)
- Consistent spacing and styling throughout

The codebase now has a unified, maintainable UI component system that follows best practices and design consistency.
