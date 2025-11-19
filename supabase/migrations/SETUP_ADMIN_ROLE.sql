-- ========================================
-- SETUP ADMIN ROLE
-- ========================================
-- Run this in Supabase SQL Editor to make yourself an admin

-- 1. First, check your current role
SELECT id, email, role FROM users;

-- 2. Update YOUR email to admin role (replace with your actual email)
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';

-- 3. Verify the change
SELECT id, email, role FROM users WHERE email = 'your-email@example.com';

-- ========================================
-- That's it! Now refresh your dashboard
-- You should see the Executive Dashboard
-- ========================================

-- To switch back to HR role for testing:
-- UPDATE users SET role = 'hr' WHERE email = 'your-email@example.com';

