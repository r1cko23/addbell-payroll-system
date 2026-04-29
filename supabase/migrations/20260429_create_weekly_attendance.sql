-- Create weekly_attendance table used by Timesheet and Payroll flows.
-- This repo's UI/API expects period_start/period_end (YYYY-MM-DD strings via PostgREST).

create table if not exists public.weekly_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  period_type text not null default 'weekly',
  attendance_data jsonb not null default '[]'::jsonb,
  total_regular_hours numeric not null default 0,
  total_overtime_hours numeric not null default 0,
  total_night_diff_hours numeric not null default 0,
  gross_pay numeric not null default 0,
  status text not null default 'draft',
  finalized_at timestamptz null,
  finalized_by uuid null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weekly_attendance_employee_period_uniq
  on public.weekly_attendance (employee_id, period_start, period_end);

alter table public.weekly_attendance enable row level security;

-- Basic policies: authenticated users can read/write (app does role checks in UI/server routes).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_attendance'
      and policyname = 'weekly_attendance_select_authenticated'
  ) then
    create policy weekly_attendance_select_authenticated
      on public.weekly_attendance
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_attendance'
      and policyname = 'weekly_attendance_write_authenticated'
  ) then
    create policy weekly_attendance_write_authenticated
      on public.weekly_attendance
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

