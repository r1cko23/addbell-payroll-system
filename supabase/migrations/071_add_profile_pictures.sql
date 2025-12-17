-- =====================================================
-- Add profile picture URL columns to users and employees
-- =====================================================

-- Add profile_picture_url to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add profile_picture_url to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create storage bucket for profile pictures if it doesn't exist
-- Note: This needs to be run manually in Supabase dashboard or via Supabase CLI
-- The bucket should be named 'profile-pictures' with public access

COMMENT ON COLUMN public.users.profile_picture_url IS 'URL to the user profile picture stored in Supabase Storage (max 100KB)';
COMMENT ON COLUMN public.employees.profile_picture_url IS 'URL to the employee profile picture stored in Supabase Storage (max 100KB)';

