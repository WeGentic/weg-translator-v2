-- ==========================================
-- Migration: RLS Policies for Companies Table
-- Date: 2025-10-29
-- Phase: 2.1
-- Description: Enable Row-Level Security on companies table
--              and create policies for SELECT, INSERT, UPDATE, DELETE
-- ==========================================

-- Step 1: Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Step 2: DROP existing policies for idempotency
DROP POLICY IF EXISTS companies_select_policy ON companies;
DROP POLICY IF EXISTS companies_insert_policy ON companies;
DROP POLICY IF EXISTS companies_update_policy ON companies;
DROP POLICY IF EXISTS companies_delete_policy ON companies;

-- Step 3: CREATE SELECT policy
-- Users can view companies where they are members
CREATE POLICY companies_select_policy ON companies
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM company_members
        WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
    )
);

-- Step 4: CREATE INSERT policy
-- Any authenticated user can create a company
CREATE POLICY companies_insert_policy ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 5: CREATE UPDATE policy
-- Only owners and admins can update companies
CREATE POLICY companies_update_policy ON companies
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM company_members
        WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
        AND company_members.role IN ('owner', 'admin')
    )
);

-- Step 6: CREATE DELETE policy
-- Only owners can delete companies
CREATE POLICY companies_delete_policy ON companies
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM company_members
        WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
        AND company_members.role = 'owner'
    )
);

-- ==========================================
-- Verification Queries
-- ==========================================

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'companies';
-- Expected: rowsecurity = true

-- Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'companies'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete)
