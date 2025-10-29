-- ==========================================
-- Migration: RLS Policies for Company Members Table
-- Date: 2025-10-29
-- Phase: 2.3
-- Description: Enable Row-Level Security on company_members table
--              and create policies for SELECT, INSERT, UPDATE, DELETE
-- ==========================================

-- Step 1: Enable RLS on company_members table
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Step 2: DROP existing policies for idempotency
DROP POLICY IF EXISTS company_members_select_policy ON company_members;
DROP POLICY IF EXISTS company_members_insert_policy ON company_members;
DROP POLICY IF EXISTS company_members_update_policy ON company_members;
DROP POLICY IF EXISTS company_members_delete_policy ON company_members;

-- Step 3: CREATE SELECT policy
-- Users can view members of companies they belong to
CREATE POLICY company_members_select_policy ON company_members
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM company_members cm
        WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
    )
);

-- Step 4: CREATE INSERT policy
-- Only owners and admins can invite new members
CREATE POLICY company_members_insert_policy ON company_members
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM company_members cm
        WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Step 5: CREATE UPDATE policy
-- Only owners can change member roles
CREATE POLICY company_members_update_policy ON company_members
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM company_members cm
        WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
);

-- Step 6: CREATE DELETE policy
-- Users can remove themselves OR owners/admins can remove others
CREATE POLICY company_members_delete_policy ON company_members
FOR DELETE
TO authenticated
USING (
    -- Self-removal
    company_members.user_id = auth.uid()
    OR
    -- Owner/admin removal of others
    EXISTS (
        SELECT 1
        FROM company_members cm
        WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- ==========================================
-- Verification Queries
-- ==========================================

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'company_members';
-- Expected: rowsecurity = true

-- Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'company_members'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete)
