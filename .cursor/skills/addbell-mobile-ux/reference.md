# Addbell mobile UX — token quick reference

## Employee portal (`lib/employee-portal-ui.ts`)

| Token | Use for |
|-------|---------|
| `epPageWrapper` | Page root (flex gap only) |
| `epPageHeaderRow` | Title + toolbar |
| `epHeaderActions` | 2-col button grid mobile |
| `epTouchButton` / `epSubmitRequestButton` | 44px touch primary |
| `epFormCard` | Request/form cards (iOS date overflow) |
| `epFormActions` / `epFormActionButton` | Stacked dialog/form footers |
| `epDialogContent` / `epDialogContentWide` | Modals |
| `epNativeSelect` | Native `<select>` |
| `epFileInput` | File inputs |
| `epCardInteractive` | List cards (hover only md+) |

## Dashboard (`lib/dashboard-ui.ts`)

| Token | Use for |
|-------|---------|
| `dbPageWrapper` | Page root |
| `dbPageHeaderRow` | Title + actions |
| `dbHeaderActions` / `dbHeaderButton` | Header button row |
| `dbToolbarActions` | Approval panels, stacked mobile |
| `dbFormCard` | Detail/form cards |
| `dbTableShell` | Scrollable tables desktop |
| `dbMobileListCard` | Mobile list items |
| `dbKpiGrid` / `dbSectionGrid` | Stat grids |
| `dbFilterSelect` | Filter dropdowns |
| `dbDialogFooter` | Dialog actions |
| `dbPeriodNavRow` / `dbPeriodNavButton` | Week/cutoff navigation |

## Split layout components

```tsx
// Dashboard
import { DbMobileBlock, DbDesktopBlock } from "@/components/dashboard/DashboardViewport";

<DbMobileBlock>{/* cards */}</DbMobileBlock>
<DbDesktopBlock className={dbTableShell}>{/* table */}</DbDesktopBlock>

// Employee portal
import { EpMobileBlock, EpDesktopBlock } from "@/components/employee-portal/EmployeePortalViewport";
```

## Popular companion skills (skills.sh)

| Skill | Installs | Install |
|-------|----------|---------|
| [web-design-guidelines](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines) | ~424K | `npx skills add vercel-labs/agent-skills@web-design-guidelines -y` |
| [impeccable](https://skills.sh/pbakaus/impeccable/impeccable) | ~175K | `npx skills add pbakaus/impeccable@impeccable -y` |
| impeccable sub-skills | ~83K each | `adapt` (responsive), `audit`, `critique`, `polish` — `npx skills add pbakaus/impeccable@adapt -y` |
| [mobile-responsiveness](https://skills.sh/hoodini/ai-agents-skills/mobile-responsiveness) | ~860 | `npx skills add hoodini/ai-agents-skills@mobile-responsiveness -y` |
| [responsive-testing](https://skills.sh/spencerpauly/awesome-cursor-skills/responsive-testing) | ~174 | `npx skills add spencerpauly/awesome-cursor-skills@responsive-testing -y` |
| [ui-ux-pro-max](https://skills.sh/davila7/claude-code-templates/ui-ux-pro-max) | large | `npx skills add davila7/claude-code-templates --skill ui-ux-pro-max -y` |

## Cursor rules (auto-apply on matching files)

- `.cursor/rules/employee-portal-mobile.mdc`
- `.cursor/rules/admin-dashboard-mobile.mdc`
