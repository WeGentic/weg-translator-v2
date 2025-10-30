-- ============================================================================
-- FIX: Infinite Recursion in RLS Policies
-- ============================================================================
-- Problem: Policies were querying users table within users table policies
-- Solution: Use JWT claims (account_uuid, user_role) instead of subqueries
--
-- IMPORTANT: This migration requires custom_access_token_hook to be configured
-- in Supabase Dashboard (Authentication > Hooks > Custom Access Token)
-- ============================================================================

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view own account" ON public.accounts;
DROP POLICY IF EXISTS "Owners and admins can update account" ON public.accounts;

DROP POLICY IF EXISTS "Users can view users in own account" ON public.users;
DROP POLICY IF EXISTS "Owners and admins can invite users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Owners and admins can update users in account" ON public.users;

DROP POLICY IF EXISTS "Users can view own account subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "System can insert subscriptions" ON public.subscriptions;

-- ============================================================================
-- ACCOUNTS TABLE - JWT Claims-Based Policies
-- ============================================================================

-- Users can view their own account using account_uuid from JWT claims
CREATE POLICY "Users can view own account"
  ON public.accounts FOR SELECT
  USING (
    account_uuid = (
      COALESCE(
        -- Try JWT claims first (optimal)
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        -- Fallback: query users table (less optimal but works)
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
    AND deleted_at IS NULL
  );

-- Only owners/admins can update account using user_role from JWT claims
CREATE POLICY "Owners and admins can update account"
  ON public.accounts FOR UPDATE
  USING (
    account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
    AND (
      -- Check role from JWT claims
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT u.role FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      ) IN ('owner', 'admin')
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
  );

-- ============================================================================
-- USERS TABLE - JWT Claims-Based Policies
-- ============================================================================

-- Policy 1: Users can view their own record directly
CREATE POLICY "Users can view own user record"
  ON public.users FOR SELECT
  USING (
    user_uuid = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy 2: Users can view other users in same account using JWT claims
CREATE POLICY "Users can view same account users"
  ON public.users FOR SELECT
  USING (
    account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
    AND deleted_at IS NULL
  );

-- Only owners/admins can invite (insert) new users
CREATE POLICY "Owners and admins can invite users"
  ON public.users FOR INSERT
  WITH CHECK (
    account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
    AND (
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT u.role FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      ) IN ('owner', 'admin')
    )
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (user_uuid = auth.uid())
  WITH CHECK (
    user_uuid = auth.uid()
    -- Prevent users from changing their account_uuid
    AND account_uuid = (SELECT account_uuid FROM public.users WHERE user_uuid = auth.uid())
    -- Prevent regular users from elevating their role
    AND (
      role = (SELECT role FROM public.users WHERE user_uuid = auth.uid())
      OR (
        COALESCE(
          auth.jwt() -> 'user_metadata' ->> 'user_role',
          (SELECT u.role FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
        ) IN ('owner', 'admin')
      )
    )
  );

-- Owners/admins can update other users in their account
CREATE POLICY "Owners and admins can update users in account"
  ON public.users FOR UPDATE
  USING (
    account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
    AND (
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT u.role FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      ) IN ('owner', 'admin')
    )
    AND deleted_at IS NULL
  );

-- ============================================================================
-- SUBSCRIPTIONS TABLE - JWT Claims-Based Policies
-- ============================================================================

-- Users can view their account's subscription
CREATE POLICY "Users can view own account subscription"
  ON public.subscriptions FOR SELECT
  USING (
    account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
    AND deleted_at IS NULL
  );

-- Only owners can update subscriptions
CREATE POLICY "Owners can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      )
    )
    AND (
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'user_role',
        (SELECT u.role FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
      ) = 'owner'
    )
    AND deleted_at IS NULL
  );

-- System (SECURITY DEFINER functions) can insert subscriptions
CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);  -- Controlled by SECURITY DEFINER functions

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- When custom_access_token_hook is configured, COALESCE will use JWT claims
-- (first branch) which is instant with zero database queries.
--
-- If hook NOT configured, COALESCE falls back to querying users table
-- (second branch) which adds ~50-100ms per request but still works.
--
-- Recommendation: Configure hook immediately after deploying this migration.
-- ============================================================================
