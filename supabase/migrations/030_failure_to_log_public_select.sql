-- =====================================================
-- Allow employee portal (anon) to read their requests
-- =====================================================
-- Employee portal uses localStorage-only session (no Supabase auth),
-- so auth.uid() is null and the current SELECT policy blocks reads.
-- The insert policy already allows anon, so we mirror that for SELECT.
-- This is intentionally permissive; UI already scopes queries by employee_id.

CREATE POLICY "failure_to_log_select_public"
ON public.failure_to_log
FOR SELECT
USING (true);