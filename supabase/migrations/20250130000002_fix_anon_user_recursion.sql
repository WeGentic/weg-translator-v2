-- ============================================================================
-- FIX: Prevent infinite recursion for anonymous users
-- ============================================================================
-- Problem: When auth.uid() is NULL (anonymous users), the fallback subquery
--          still executes and causes infinite recursion
-- Solution: Add auth.uid() IS NOT NULL check before any subqueries
-- ============================================================================

-- Drop and recreate policies with anonymous user protection

-- ACCOUNTS TABLE
DROP POLICY IF EXISTS "Users can view own account" ON public.accounts;
DROP POLICY IF EXISTS "Owners and admins can update account" ON public.accounts;

CREATE POLICY "Users can view own account"
  ON public.accounts FOR SELECT
  USING (
    auth.uid() IS NOT NULL  -- ✨ Key fix: short-circuit for anon users
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
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

-- USERS TABLE
DROP POLICY IF EXISTS "Users can view own user record" ON public.users;
DROP POLICY IF EXISTS "Users can view same account users" ON public.users;
DROP POLICY IF EXISTS "Owners and admins can invite users" ON public.users;
DROP POLICY IF EXISTS "Owners and admins can update users in account" ON public.users;

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
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
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

CREATE POLICY "Owners and admins can update users in account"
  ON public.users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
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

-- SUBSCRIPTIONS TABLE
DROP POLICY IF EXISTS "Users can view own account subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners can update subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view own account subscription"
  ON public.subscriptions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND account_uuid = (
      COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'account_uuid')::uuid,
        (SELECT u.account_uuid FROM public.users u WHERE u.user_uuid = auth.uid() AND u.deleted_at IS NULL LIMIT 1)
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

-- ============================================================================
-- EXPLANATION
-- ============================================================================
-- Adding "auth.uid() IS NOT NULL" at the start of each policy ensures that:
-- 1. Anonymous users immediately get FALSE, skipping all subqueries
-- 2. No infinite recursion occurs for unauthenticated access
-- 3. Authenticated users proceed to JWT claims check → fallback query
-- 4. Performance is optimal (JWT claims) with graceful degradation (fallback)
-- ============================================================================
