-- ==========================================
-- Migration: RLS Policies for Profiles Table
-- Date: 2025-10-29
-- Phase: 2.2
-- Description: Enable Row-Level Security on profiles table
--              and create policies for SELECT, INSERT, UPDATE, DELETE
-- ==========================================

-- Step 1: Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 2: DROP existing policies for idempotency
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON profiles;

-- Step 3: CREATE SELECT policy
-- Users can view own profile OR profiles of company co-members
CREATE POLICY profiles_select_policy ON profiles
FOR SELECT
TO authenticated
USING (
    -- Own profile
    profiles.id = auth.uid()
    OR
    -- Co-member's profile (self-join on company_members)
    EXISTS (
        SELECT 1
        FROM company_members cm1
        JOIN company_members cm2 ON cm1.company_id = cm2.company_id
        WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.id
    )
);

-- Step 4: CREATE INSERT policy
-- Users can only create their own profile
-- (typically handled by trigger, but policy enforces constraint)
CREATE POLICY profiles_insert_policy ON profiles
FOR INSERT
TO authenticated
WITH CHECK (profiles.id = auth.uid());

-- Step 5: CREATE UPDATE policy
-- Users can only update their own profile
CREATE POLICY profiles_update_policy ON profiles
FOR UPDATE
TO authenticated
USING (profiles.id = auth.uid());

-- Step 6: CREATE DELETE policy
-- Users can only delete their own profile
CREATE POLICY profiles_delete_policy ON profiles
FOR DELETE
TO authenticated
USING (profiles.id = auth.uid());

-- ==========================================
-- Verification Queries
-- ==========================================

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';
-- Expected: rowsecurity = true

-- Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete)
