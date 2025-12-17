-- =====================================================
-- Cleanup Duplicate Profile Pictures
-- =====================================================
-- This script helps identify and clean up duplicate profile pictures
-- Run this via Supabase SQL Editor or CLI

-- Step 1: Find all profile pictures and group by user
-- This will show you which users have multiple profile pictures
SELECT 
  SUBSTRING(name FROM '^([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)') as user_id_prefix,
  COUNT(*) as file_count,
  ARRAY_AGG(name ORDER BY created_at DESC) as file_names,
  SUM((metadata->>'size')::bigint) as total_size_bytes
FROM storage.objects
WHERE bucket_id = 'profile-pictures'
GROUP BY user_id_prefix
HAVING COUNT(*) > 1
ORDER BY file_count DESC;

-- Step 2: For each user, keep only the most recent file
-- This query shows what would be deleted (keep the first one, delete the rest)
WITH ranked_files AS (
  SELECT 
    name,
    SUBSTRING(name FROM '^([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)') as user_id_prefix,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY SUBSTRING(name FROM '^([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)') 
      ORDER BY created_at DESC
    ) as rn
  FROM storage.objects
  WHERE bucket_id = 'profile-pictures'
)
SELECT 
  name as file_to_delete,
  user_id_prefix,
  created_at
FROM ranked_files
WHERE rn > 1
ORDER BY user_id_prefix, created_at DESC;

-- Step 3: Actually delete the duplicates (UNCOMMENT TO RUN)
-- WARNING: This will permanently delete files. Review the results above first!
/*
WITH ranked_files AS (
  SELECT 
    name,
    SUBSTRING(name FROM '^([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)') as user_id_prefix,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY SUBSTRING(name FROM '^([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)') 
      ORDER BY created_at DESC
    ) as rn
  FROM storage.objects
  WHERE bucket_id = 'profile-pictures'
),
files_to_delete AS (
  SELECT name
  FROM ranked_files
  WHERE rn > 1
)
DELETE FROM storage.objects
WHERE bucket_id = 'profile-pictures'
  AND name IN (SELECT name FROM files_to_delete);
*/

-- Step 4: Verify cleanup
SELECT 
  SUBSTRING(name FROM '^([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)') as user_id_prefix,
  COUNT(*) as file_count
FROM storage.objects
WHERE bucket_id = 'profile-pictures'
GROUP BY user_id_prefix
HAVING COUNT(*) > 1;
