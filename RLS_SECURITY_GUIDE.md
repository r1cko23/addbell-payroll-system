# 🔒 Row Level Security (RLS) Setup Guide

## ⚠️ **IMPORTANT: For After Your Demo**

**Do NOT enable RLS now** - Keep tables unrestricted during demo/presentation so you can edit data easily.

**Enable RLS after** your demo is complete to secure your production data.

---

## What is RLS?

Row Level Security (RLS) restricts who can read/write data in your tables. Without RLS, tables show "UNRESTRICTED" and anyone with database access can see/edit everything.

## Current Unrestricted Tables

Based on your Supabase dashboard, these **3 tables/views** are currently unrestricted:

- `office_locations` (table)
- `approved_overtime` (view)
- `pending_ot_count` (view)

---

## How to Enable RLS (After Demo)

### Step 1: Enable RLS on Each Table/View

Run this SQL in Supabase SQL Editor:

```sql
-- Enable RLS on the table
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

-- Note: Views (approved_overtime, pending_ot_count) inherit RLS from their base tables
-- If you need to restrict views, you'll need to recreate them with SECURITY DEFINER
-- or ensure the underlying tables have proper RLS policies
```

### Step 2: Create Policies

After enabling RLS, you need policies to allow access. Here are policies for your 3 unrestricted items:

#### **1. Office Locations** (Public Read, HR/Admin Write)

```sql
-- Anyone can read office locations (needed for location validation)
CREATE POLICY "Office locations are viewable by everyone"
ON public.office_locations FOR SELECT
USING (true);

-- Only HR/Admin can insert/update/delete office locations
CREATE POLICY "HR and Admin can manage office locations"
ON public.office_locations FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role IN ('hr', 'admin')
  )
);

CREATE POLICY "HR and Admin can update office locations"
ON public.office_locations FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role IN ('hr', 'admin')
  )
);

CREATE POLICY "HR and Admin can delete office locations"
ON public.office_locations FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role IN ('hr', 'admin')
  )
);
```

#### **2. Approved Overtime View** (Inherits from base tables)

**Note:** Views inherit RLS from their base tables. If `approved_overtime` is a view based on `overtime_requests`, ensure `overtime_requests` has proper RLS:

```sql
-- Check what the view is based on
SELECT definition FROM pg_views WHERE viewname = 'approved_overtime';

-- Typically, views inherit RLS from their base tables
-- If you need to restrict the view specifically, you may need to recreate it
-- with SECURITY DEFINER or ensure underlying tables have RLS
```

#### **3. Pending OT Count View** (Inherits from base tables)

**Note:** Same as above - views inherit RLS from base tables:

```sql
-- Check what the view is based on
SELECT definition FROM pg_views WHERE viewname = 'pending_ot_count';

-- Ensure the base table (likely overtime_requests) has proper RLS policies
```

---

## Quick Enable Script (Run After Demo)

Save this and run it when ready:

```sql
-- =====================================================
-- ENABLE RLS ON UNRESTRICTED TABLES
-- =====================================================
-- Run this AFTER your demo/presentation

-- Enable RLS on office_locations table
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for office_locations
CREATE POLICY "Office locations are viewable by everyone"
ON public.office_locations FOR SELECT
USING (true);

CREATE POLICY "HR and Admin can manage office locations"
ON public.office_locations FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role IN ('hr', 'admin')
  )
);

-- Note: Views (approved_overtime, pending_ot_count) inherit RLS
-- from their base tables. Ensure overtime_requests table has RLS enabled.
```

---

## Temporarily Disable RLS (If Needed)

If you enable RLS and need to edit during demo:

```sql
-- Disable RLS temporarily
ALTER TABLE public.office_locations DISABLE ROW LEVEL SECURITY;

-- Drop policies temporarily
DROP POLICY IF EXISTS "Office locations are viewable by everyone" ON public.office_locations;
DROP POLICY IF EXISTS "HR and Admin can manage office locations" ON public.office_locations;
```

**⚠️ Remember to re-enable after demo!**

---

## Understanding Views vs Tables

**Views** (`approved_overtime`, `pending_ot_count`) don't have their own RLS - they inherit from base tables.

To restrict views:

1. **Option 1**: Ensure base tables have RLS (recommended)
2. **Option 2**: Recreate view with `SECURITY DEFINER` and add RLS to the view

Check what tables your views are based on:

```sql
-- See view definitions
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('approved_overtime', 'pending_ot_count');
```

## Testing RLS Policies

After enabling RLS, test with different user roles:

```sql
-- Test as employee (should see office locations but not manage)
SELECT * FROM office_locations; -- Should work (public read)
INSERT INTO office_locations (...) VALUES (...); -- Should fail

-- Test as HR/Admin (should see and manage)
SELECT * FROM office_locations; -- Should work
INSERT INTO office_locations (...) VALUES (...); -- Should work
```

---

## Summary

1. **Now (Demo)**: Keep tables unrestricted ✅
2. **After Demo**: Enable RLS + Create policies 🔒
3. **If Needed**: Temporarily disable RLS for edits ⚠️

**Keep this guide handy for after your presentation!** 📋
