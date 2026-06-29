---
name: addbell-mobile-ux
description: >-
  Audits and implements mobile-first UI/UX for the Addbell payroll system
  (employee portal + HR dashboard). Use when improving responsive layout, touch
  targets, tables on small screens, dialogs, approval flows, fund requests,
  bundy, leave/OT forms, or when the user mentions mobile, responsive, iPhone,
  tablet, touch, or viewport UX. Pair with vercel-labs/agent-skills
  web-design-guidelines for generic a11y/UX audits.
---

# Addbell mobile UX

Addbell has **two UI surfaces** with different utility libraries. Always identify which surface you are editing before changing layout.

| Surface | Paths | Utilities | Viewport helpers |
|---------|-------|-----------|------------------|
| Employee portal | `app/employee-portal/**`, `components/EmployeePortal*.tsx` | `@/lib/employee-portal-ui` | `EpMobileBlock`, `EpDesktopBlock` in `@/components/employee-portal/EmployeePortalViewport` |
| HR dashboard | `app/**` (non-portal), `components/dashboard/**`, `*-approval/**`, `fund-request/**` | `@/lib/dashboard-ui` | `DbMobileBlock`, `DbDesktopBlock` in `@/components/dashboard/DashboardViewport` |

## Required reading (do this first)

1. `.cursor/rules/employee-portal-mobile.mdc` — portal patterns
2. `.cursor/rules/admin-dashboard-mobile.mdc` — dashboard patterns
3. `lib/employee-portal-ui.ts` and `lib/dashboard-ui.ts` — reuse tokens; do not invent duplicate class strings
4. `lib/employee-portal-viewport.ts` and `lib/dashboard-viewport.ts` — breakpoint tiers

**Complementary skills (in this repo under `.agents/skills/`):**

- `web-design-guidelines` — accessibility and generic UX audits
- `impeccable` — anti-generic UI craft; see `.cursor/skills/impeccable-adapt/` for responsive adaptation
- `mobile-responsiveness` — mobile-first layout patterns
- `responsive-testing` — multi-viewport screenshot verification

Install or refresh with `npx skills add <source> -y` if missing.

## Viewport tiers

| Tier | Width | Employee portal | Dashboard |
|------|-------|-----------------|-----------|
| Mobile | < 768px (`md`) | Bottom nav, stacked forms, full-width actions | Hamburger nav, card lists, 2-col action grids |
| Tablet | 768–1023px | Sidebar, single-column content | Sidebar overlay, single-column sections |
| Laptop+ | ≥ 1024px (`lg`) | Multi-column forms, full padding | Fixed sidebar, table layouts |

Test at **~390px** (iPhone), **~412px** (Android), **768px** (tablet), and **1280px** (laptop).

## Implementation workflow

1. **Identify surface** — portal vs dashboard; import the correct `ep*` or `db*` utilities.
2. **Mobile first** — default `flex-col` / `grid-cols-1`; add `sm:` / `md:` / `lg:` enhancements only where needed.
3. **Page root** — one wrapper only: `epPageWrapper` or `dbPageWrapper`. Never combine with `VStack gap` or `space-y` on the same root (doubles vertical spacing on phones).
4. **Touch targets** — primary actions `min-h-11` (portal) or `min-h-10` (dashboard) on mobile; may shrink at `sm:`.
5. **Overflow** — `min-w-0` + `truncate` on names/IDs; `overflow-x-clip` on form cards (`epFormCard`, `dbFormCard`).
6. **Tables** — desktop table inside `dbTableShell`; mobile **card stack** via `DbMobileBlock` / `DbDesktopBlock` (see fund request inbox, vendor directory).
7. **Dialogs** — portal: `epDialogContent` / `epDialogContentWide`; dashboard: `dbDialogFooter` for stacked mobile actions.
8. **Tabs** — `TabsList` with `overflow-x-auto` when many tabs (fund request page pattern).
9. **Motion** — no hover-only affordances on touch; use `motion-safe:md:hover:…` or `epCardInteractive`.
10. **Copy** — dashboard page titles and subtitles use **title case** via `toTitleCase` (`DashboardPageHeader`, `CardSection` descriptions, dashboard home `CardDescription`). Employee portal body copy stays **sentence case** with a period.

## Pre-ship checklist

- [ ] No horizontal page scroll at 390px width
- [ ] Primary buttons full-width on mobile where appropriate (`sm:w-auto` on desktop)
- [ ] Approval/action toolbars use `dbToolbarActions` or `dbHeaderActions`
- [ ] Long text truncates; amounts and badges do not push layout off-screen
- [ ] Form fields and native selects use `epNativeSelect` / `dbFilterSelect` on mobile
- [ ] iOS safe areas respected in portal shell (`env(safe-area-inset-*)`)
- [ ] No duplicate spacing from nested gap utilities

## Anti-patterns (fix on sight)

| Problem | Fix |
|---------|-----|
| Table-only layout on mobile | Add `DbMobileBlock` card list |
| `setShowRejectForm`-style dead state | Match existing disposal/action patterns |
| Raw `grid-cols-3` on form rows without mobile collapse | `grid-cols-1 sm:grid-cols-3` or side-by-side only from `sm:` |
| Title case on employee portal body subtitles | Dashboard titles/subtitles use `toTitleCase`; portal subtitles stay sentence case |
| Loading 5MB images to DB | Use `compressImageForUpload` + Storage (fund request docs) |

## Audit output format

When asked to audit (not implement), return:

```markdown
## Mobile UX audit — [page/component]

### Critical
- [file:line] Issue — suggested fix — utility/pattern to use

### Improvements
- ...

### Passed
- ...
```

## Reference implementations

- Fund request UM inbox: `FundRequestClientGroupedInbox.tsx` (mobile cards + desktop table)
- Fund request approval: `FundRequestApprovalDetail.tsx` (`dbToolbarActions`, `dbHeaderButton`)
- Employee portal header: `EmployeePortalHeader.tsx` (`EpMobileBlock` / `EpDesktopBlock`)
- Vendor directory: `VendorDirectoryPage.tsx` (split viewport blocks)

See [reference.md](reference.md) for token quick-reference.
