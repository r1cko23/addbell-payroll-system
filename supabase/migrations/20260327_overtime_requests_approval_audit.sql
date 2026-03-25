-- Ensure OT approval audit fields exist (avoids PostgREST 400 when PATCH omitted unknown columns).
-- UUIDs are auth user ids (profiles.id); no FK so older DBs without profiles still apply.

ALTER TABLE public.overtime_requests
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS account_manager_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.overtime_requests.approved_by IS 'Profile/user id who approved or rejected';
COMMENT ON COLUMN public.overtime_requests.account_manager_id IS 'Mirrors approver for reporting (legacy name)';
COMMENT ON COLUMN public.overtime_requests.approved_at IS 'When the decision was recorded';
