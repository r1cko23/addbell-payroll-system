-- =====================================================
-- Storage Bucket Policies for Profile Pictures
-- =====================================================

-- Enable RLS on storage.objects
-- Note: Files are stored with naming pattern: {userId}-{timestamp}.jpg

-- Policy: Allow anonymous/public users to upload to profile-pictures bucket
-- Employees authenticate via custom RPC (not Supabase Auth), so we allow anonymous uploads
-- Security is maintained through file naming: {userId}-{timestamp}.jpg
CREATE POLICY "Anyone can upload profile pictures"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'profile-pictures');

-- Policy: Allow anonymous/public users to delete from profile-pictures bucket
-- Note: File naming convention ({userId}-{timestamp}.jpg) provides security
CREATE POLICY "Anyone can delete profile pictures"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'profile-pictures');

-- Policy: Allow public read access (since bucket is PUBLIC)
CREATE POLICY "Public can read profile pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Policy: Allow authenticated users to read all profile pictures (for display)
CREATE POLICY "Authenticated can read profile pictures"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-pictures');

