# UI/UX Refactoring Guide - Astrea HR Dashboard Aesthetic

This guide documents the comprehensive UI/UX refactoring to achieve a clean, organized, spacious, and professional design aesthetic.

## 🎨 Design Principles

- **Generous whitespace** and breathing room
- **Consistent card-based layouts** with subtle shadows
- **Clear visual hierarchy** with refined typography
- **Muted color palette** (grays, accents)
- **Organized tabs, filters, and data tables** with good visual separation
- **Icons integrated seamlessly** with text

## 📦 New Component System

### 1. Typography Components (`components/ui/typography.tsx`)

Use semantic typography components instead of raw HTML tags:

```tsx
import { H1, H2, H3, H4, Body, BodySmall, Label, Caption } from '@/components/ui/typography'

// ✅ After
<H1>Dashboard</H1>
<BodySmall>Manage your employees</BodySmall>

// ❌ Before
<h1 className="text-3xl font-bold">Dashboard</h1>
<p className="text-sm text-muted-foreground">Manage your employees</p>
```

**Available Components:**

- `H1` - Main page titles
- `H2` - Section headings
- `H3` - Subsection headings
- `H4` - Card titles
- `Body` - Standard body text
- `BodySmall` - Secondary body text (muted)
- `Label` - Form labels
- `Caption` - Small captions and metadata

### 2. Layout Components (`components/ui/stack.tsx`)

Use Stack components for consistent spacing:

```tsx
import { HStack, VStack, Stack } from '@/components/ui/stack'

// ✅ After
<VStack gap="8" className="p-8">
  <HStack justify="between" align="center">
    <H1>Title</H1>
    <Button>Action</Button>
  </HStack>
</VStack>

// ❌ Before
<div className="space-y-6">
  <div className="flex justify-between items-center">
    <h1>Title</h1>
    <Button>Action</Button>
  </div>
</div>
```

**Props:**

- `gap`: '2' | '3' | '4' | '6' | '8' | '10' (spacing scale)
- `direction`: 'row' | 'col'
- `align`: 'start' | 'center' | 'end' | 'stretch'
- `justify`: 'start' | 'center' | 'between' | 'end'

**Convenience Components:**

- `HStack` - Horizontal stack (direction="row")
- `VStack` - Vertical stack (direction="col")

### 3. Card Section (`components/ui/card-section.tsx`)

Use CardSection for consistent card layouts:

```tsx
import { CardSection } from '@/components/ui/card-section'

// ✅ After
<CardSection
  title="Employee Directory"
  description="Search, edit, and manage employee portal access."
>
  {/* Content */}
</CardSection>

// ❌ Before
<Card>
  <CardHeader>
    <CardTitle>Employee Directory</CardTitle>
    <CardDescription>Search, edit, and manage employee portal access.</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### 4. Icon System (`components/ui/phosphor-icon.tsx`)

Use the Icon component for consistent icon usage:

```tsx
import { Icon, IconSizes } from '@/components/ui/phosphor-icon'

// ✅ After
<HStack gap="2" align="center">
  <Icon name="Check" size={IconSizes.sm} weight="regular" />
  <BodySmall>Saved</BodySmall>
</HStack>

// ❌ Before
<MagnifyingGlass size={32} weight="bold" style={{ color: '#999' }} />
```

**Icon Sizes:**

- `IconSizes.xs` - 16px (Small badges, tight UI)
- `IconSizes.sm` - 20px (Inputs, buttons, nav items)
- `IconSizes.md` - 24px (Standard UI, cards)
- `IconSizes.lg` - 32px (Feature highlights)
- `IconSizes.xl` - 40px (Hero sections)

**Default weight:** `regular` (use consistently)

### 5. Input Group (`components/ui/input-group.tsx`)

Use InputGroup for form fields with labels and descriptions:

```tsx
import { InputGroup } from "@/components/ui/input-group";

// ✅ After
<VStack gap="4">
  <InputGroup
    label="Email"
    type="email"
    placeholder="you@example.com"
    description="We'll never share your email"
  />
  <InputGroup
    label="Password"
    type="password"
    placeholder="••••••••"
    error={errors.password}
  />
</VStack>;
```

## 🎯 Spacing System

Use the Tailwind spacing scale consistently:

- `gap-2` = 8px
- `gap-3` = 12px
- `gap-4` = 16px (most common)
- `gap-6` = 24px
- `gap-8` = 32px
- `gap-10` = 40px

**Page-level spacing:** Use `gap-8` for main sections
**Card content spacing:** Use `gap-4` or `space-y-4`
**Form spacing:** Use `gap-4` between fields

## 🎨 Design Tokens

### Shadows

- `shadow-card` - Subtle card shadow (0 1px 3px rgba(0, 0, 0, 0.08))
- `shadow-hover` - Hover state shadow (0 4px 12px rgba(0, 0, 0, 0.12))

### Border Radius

- `rounded-sm` - 6px
- `rounded-md` - 8px
- `rounded-lg` - 12px

### Colors

- `muted-light` - Very light gray background (hsl(0 0% 96%))

## 📋 Refactoring Checklist

When refactoring a page:

- [ ] Replace all `<h1>`, `<h2>`, etc. with Typography components
- [ ] Replace manual flex layouts with HStack/VStack
- [ ] Replace Card + CardHeader + CardContent with CardSection
- [ ] Replace direct Phosphor icon imports with Icon component
- [ ] Replace hardcoded spacing with Tailwind scale (gap-4, gap-8, etc.)
- [ ] Replace inline styles with Tailwind classes
- [ ] Use InputGroup for form fields
- [ ] Ensure consistent icon sizes (use IconSizes enum)
- [ ] Use consistent icon weight (regular by default)

## 🔄 Migration Example

### Before:

```tsx
<div className="space-y-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
        Employee Management
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Manage employee records and view schedules.
      </p>
    </div>
    <Button onClick={openAddModal}>
      <Plus className="h-4 w-4" />
      Add Employee
    </Button>
  </div>
</div>
```

### After:

```tsx
<VStack gap="8" className="p-8">
  <HStack justify="between" align="center">
    <VStack gap="2" align="start">
      <H1>Employee Management</H1>
      <BodySmall>Manage employee records and view schedules.</BodySmall>
    </VStack>
    <Button onClick={openAddModal}>
      <Icon name="Plus" size={IconSizes.sm} />
      Add Employee
    </Button>
  </HStack>
</VStack>
```

## 📚 Component Reference

### Typography

- `components/ui/typography.tsx`

### Layout

- `components/ui/stack.tsx`

### Cards

- `components/ui/card-section.tsx`
- `components/ui/card.tsx` (updated with shadow-card)

### Forms

- `components/ui/input-group.tsx`
- `components/ui/input.tsx`

### Icons

- `components/ui/phosphor-icon.tsx`

## 🎯 Next Steps

1. Refactor remaining pages using these patterns
2. Replace all inline styles with Tailwind classes
3. Standardize icon usage across the app
4. Ensure consistent spacing on all pages
5. Update form components to use InputGroup
