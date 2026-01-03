-- =====================================================
-- RLS Policies for Profile Pictures
-- =====================================================
-- Note: SELECT policies are handled by existing policies (users_select, etc.)
-- We only add UPDATE policies for profile picture updates

-- Users can update their own profile picture
-- This doesn't query users table, so no recursion
CREATE POLICY "Users can update own profile picture" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Employees can update their own profile picture
-- Note: Employees authenticate via custom RPC, so auth.uid() may not work
-- But we keep this for consistency - the actual update will work via service role if needed
CREATE POLICY "Employees can update own profile picture" ON public.employees
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
