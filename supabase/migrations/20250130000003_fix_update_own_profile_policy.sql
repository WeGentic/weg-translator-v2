-- ============================================================================
-- FIX: Update own profile policy still has recursive logic
-- ============================================================================
-- Problem: "Users can update own profile" policy references users table
--          within users table policy, causing infinite recursion
-- Solution: Simplify to only allow updating own record without subqueries
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Simplified policy: users can only update their own record
-- Prevent account_uuid changes and role escalation without recursive subqueries
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND user_uuid = auth.uid()
  )
  WITH CHECK (
    user_uuid = auth.uid()
    -- These checks happen AFTER the update is proposed, so OLD values are still accessible
    -- However, we can't use subqueries here without recursion
    -- Instead, rely on application-level validation and the fact that
    -- Postgres will reject updates that violate foreign key constraints
  );

-- Note: To truly prevent account_uuid changes and role escalation,
-- we should use database triggers or handle this in application code.
-- For now, this prevents the infinite recursion while maintaining basic security.

-- ============================================================================
-- ALTERNATIVE SOLUTION: Use triggers for validation (more robust)
-- ============================================================================

-- Create a trigger function to prevent dangerous changes
CREATE OR REPLACE FUNCTION public.prevent_user_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent changing account_uuid
  IF NEW.account_uuid IS DISTINCT FROM OLD.account_uuid THEN
    RAISE EXCEPTION 'Users cannot change their account_uuid';
  END IF;

  -- Prevent role escalation unless user is owner/admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Check if current user has permission to change roles
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE user_uuid = auth.uid()
        AND role IN ('owner', 'admin')
        AND account_uuid = NEW.account_uuid
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Only owners and admins can change user roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS enforce_user_update_rules ON public.users;

-- Create trigger
CREATE TRIGGER enforce_user_update_rules
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_self_escalation();

-- ============================================================================
-- EXPLANATION
-- ============================================================================
-- This approach uses a BEFORE UPDATE trigger instead of complex RLS policies
-- to prevent account_uuid changes and role escalation. Benefits:
-- 1. No infinite recursion (trigger runs outside RLS context)
-- 2. Clear error messages for users
-- 3. Enforced at database level (can't bypass via API)
-- 4. Better performance (single trigger check vs multiple policy evaluations)
-- ============================================================================
