-- ============================================================================
-- FINAL FIX: Use SECURITY DEFINER function to break recursion cycle
-- ============================================================================
-- Problem: Fallback queries in RLS policies cause infinite recursion
-- Solution: Create SECURITY DEFINER function that bypasses RLS for lookups
-- ============================================================================

-- Create helper function that bypasses RLS to get current user's account info
CREATE OR REPLACE FUNCTION public.get_current_user_account_info()
RETURNS TABLE (
  account_uuid uuid,
  user_role text
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's privileges, bypassing RLS
STABLE  -- Result doesn't change within a transaction
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.account_uuid, u.role
  FROM public.users u
  WHERE u.user_uuid = auth.uid()
    AND u.deleted_at IS NULL
  LIMIT 1;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_account_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_account_info() TO anon;

-- ============================================================================
-- DROP ALL EXISTING POLICIES
-- ============================================================================

-- Accounts
DROP POLICY IF EXISTS "Users can view own account" ON public.accounts;
DROP POLICY IF EXISTS "Owners and admins can update account" ON public.accounts;

-- Users
DROP POLICY IF EXISTS "Users can view own user record" ON public.users;
DROP POLICY IF EXISTS "Users can view same account users" ON public.users;
DROP POLICY IF EXISTS "Owners and admins can invite users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Owners and admins can update users in account" ON public.users;

-- Subscriptions
DROP POLICY IF EXISTS "Users can view own account subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "System can insert subscriptions" ON public.subscriptions;

-- ============================================================================
-- CREATE NEW NON-RECURSIVE POLICIES USING SECURITY DEFINER FUNCTION
-- ============================================================================

-- ACCOUNTS POLICIES
CREATE POLICY "Users can view own account"
  ON public.accounts FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT account_uuid FROM public.get_current_user_account_info())
      )
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Owners and admins can update account"
  ON public.accounts FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT account_uuid FROM public.get_current_user_account_info())
      )
    )
    AND (
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT user_role FROM public.get_current_user_account_info())
      ) IN ('owner', 'admin')
    )
    AND deleted_at IS NULL
  );

-- USERS POLICIES
CREATE POLICY "Users can view own user record"
  ON public.users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND user_uuid = auth.uid()
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can view same account users"
  ON public.users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT account_uuid FROM public.get_current_user_account_info())
      )
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Owners and admins can invite users"
  ON public.users FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT account_uuid FROM public.get_current_user_account_info())
      )
    )
    AND (
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT user_role FROM public.get_current_user_account_info())
      ) IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND user_uuid = auth.uid()
  )
  WITH CHECK (
    user_uuid = auth.uid()
  );

CREATE POLICY "Owners and admins can update users in account"
  ON public.users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT account_uuid FROM public.get_current_user_account_info())
      )
    )
    AND (
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT user_role FROM public.get_current_user_account_info())
      ) IN ('owner', 'admin')
    )
    AND deleted_at IS NULL
  );

-- SUBSCRIPTIONS POLICIES
CREATE POLICY "Users can view own account subscription"
  ON public.subscriptions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT account_uuid FROM public.get_current_user_account_info())
      )
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Owners can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT account_uuid FROM public.get_current_user_account_info())
      )
    )
    AND (
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT user_role FROM public.get_current_user_account_info())
      ) = 'owner'
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- EXPLANATION
-- ============================================================================
-- The SECURITY DEFINER function bypasses RLS when querying the users table,
-- breaking the infinite recursion cycle. This is safe because:
-- 1. Function only returns data for auth.uid() (can't query other users)
-- 2. Function is STABLE (result cached within transaction for performance)
-- 3. Policies first try JWT claims (optimal), then call function (safe fallback)
-- 4. Anonymous users (auth.uid() IS NULL) are rejected before function call
-- ============================================================================
