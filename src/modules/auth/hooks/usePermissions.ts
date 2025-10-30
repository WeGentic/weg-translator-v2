/**
 * @file usePermissions.ts
 * @description Hook that extracts user role from AuthProvider context and returns
 * permission flags for role-based UI access control.
 *
 * IMPORTANT: This provides UI-level access control only. Actual security enforcement
 * happens at the RLS policy level in Supabase. This hook simply hides/shows UI elements
 * to improve UX and prevent users from attempting unauthorized actions.
 *
 * @see Task 8: Implement role-based permissions UI controls using JWT claims
 * @see FR-007: Role-Based UI Permissions and Authorization
 */

import { useMemo } from "react";
import { useAuth } from "@/app/providers/auth/AuthProvider";
import type { UserRole } from "@/shared/types/database";
import { logger } from "@/core/logging";

/**
 * Permission flags returned by usePermissions hook.
 * Each flag indicates whether the current user's role permits a specific action.
 *
 * RLS Policy Alignment (Defense-in-Depth):
 * - canManageAccount: Backed by RLS policies allowing UPDATE on accounts table
 * - canInviteUsers: Backed by RLS policies allowing INSERT on users table
 * - canDeleteAccount: Backed by RLS policies allowing UPDATE deleted_at on accounts table (owner only)
 * - canEditSettings: Backed by RLS policies allowing UPDATE on accounts table
 *
 * @see subtask 8.4 for RLS policy documentation
 */
export interface PermissionFlags {
  /**
   * Can manage account settings (name, email, billing details).
   * - Owner: ✅ true - Full account management
   * - Admin: ✅ true - Can manage most account settings
   * - Member: ❌ false - Read-only access to account
   * - Viewer: ❌ false - Read-only access to account
   *
   * RLS Policy: Owner and Admin can UPDATE accounts table
   */
  canManageAccount: boolean;

  /**
   * Can invite new users to the account.
   * - Owner: ✅ true - Can invite any role
   * - Admin: ✅ true - Can invite member/viewer
   * - Member: ❌ false - Cannot invite users
   * - Viewer: ❌ false - Cannot invite users
   *
   * RLS Policy: Owner and Admin can INSERT into users table
   */
  canInviteUsers: boolean;

  /**
   * Can delete account (dangerous operation).
   * - Owner: ✅ true - Only owner can delete account
   * - Admin: ❌ false - Cannot delete account for protection
   * - Member: ❌ false - Cannot delete account
   * - Viewer: ❌ false - Cannot delete account
   *
   * RLS Policy: ONLY Owner can UPDATE accounts SET deleted_at = now()
   */
  canDeleteAccount: boolean;

  /**
   * Can edit account settings and preferences.
   * - Owner: ✅ true - Full settings access
   * - Admin: ✅ true - Most settings (not dangerous ops)
   * - Member: ❌ false - Read-only settings
   * - Viewer: ❌ false - Read-only settings
   *
   * RLS Policy: Owner and Admin can UPDATE accounts table
   */
  canEditSettings: boolean;
}

/**
 * Calculates permission flags based on user role.
 * Implements role-based access control with defense-in-depth:
 * - Frontend: Hides/disables UI elements users cannot access
 * - RLS Policies: Enforces permissions at database level
 *
 * Role Hierarchy (descending privilege):
 * 1. Owner - Full account control including dangerous operations
 * 2. Admin - Account management except dangerous operations
 * 3. Member - Standard user access without management capabilities
 * 4. Viewer - Read-only access across entire application
 *
 * @param role - User role from AuthProvider context
 * @returns PermissionFlags object with boolean flags for each permission
 */
function calculatePermissions(role: UserRole | null): PermissionFlags {
  // Fail-closed: No role = no permissions
  if (!role) {
    return {
      canManageAccount: false,
      canInviteUsers: false,
      canDeleteAccount: false,
      canEditSettings: false,
    };
  }

  // TASK 8.2: Permission calculation logic for each role tier
  switch (role) {
    case "owner":
      // Owner role: Full account control including dangerous operations
      // RLS Policy: Owner can UPDATE/DELETE accounts, UPDATE/DELETE users, UPDATE subscriptions
      return {
        canManageAccount: true, // ✅ Full account management
        canInviteUsers: true, // ✅ Can invite any role
        canDeleteAccount: true, // ✅ Can delete account (dangerous op)
        canEditSettings: true, // ✅ Full settings access
      };

    case "admin":
      // Admin role: Most management actions except dangerous operations
      // RLS Policy: Admin can UPDATE accounts (not DELETE), UPDATE users (not DELETE), read subscriptions
      return {
        canManageAccount: true, // ✅ Can manage account settings
        canInviteUsers: true, // ✅ Can invite member/viewer
        canDeleteAccount: false, // ❌ Cannot delete account for protection
        canEditSettings: true, // ✅ Can edit settings
      };

    case "member":
      // Member role: Standard user access without management capabilities
      // RLS Policy: Member can read own user record, read account, read subscriptions
      return {
        canManageAccount: false, // ❌ Read-only account
        canInviteUsers: false, // ❌ Cannot invite users
        canDeleteAccount: false, // ❌ Cannot delete account
        canEditSettings: false, // ❌ Read-only settings
      };

    case "viewer":
      // Viewer role: Read-only access across entire application
      // RLS Policy: Viewer can read own user record, read account, read subscriptions (no writes)
      return {
        canManageAccount: false, // ❌ Read-only account
        canInviteUsers: false, // ❌ Cannot invite users
        canDeleteAccount: false, // ❌ Cannot delete account
        canEditSettings: false, // ❌ Read-only settings
      };

    default:
      // Unknown role: Fail-closed with no permissions
      logger.warn("Unknown user role, defaulting to no permissions", {
        role,
        correlationId: crypto.randomUUID(),
      });
      return {
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      };
  }
}

/**
 * Hook that provides role-based permission flags for UI access control.
 *
 * Usage Example:
 * ```tsx
 * function AccountSettings() {
 *   const { canEditSettings, canDeleteAccount } = usePermissions();
 *
 *   return (
 *     <div>
 *       <Button disabled={!canEditSettings}>Edit Account</Button>
 *       {canDeleteAccount && <Button variant="destructive">Delete Account</Button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * Integration with Subscription Status:
 * ```tsx
 * const { canInviteUsers } = usePermissions();
 * const { hasActiveSubscription } = useAuth();
 *
 * // Layer permissions: Both role AND subscription must be valid
 * const canInvite = canInviteUsers && hasActiveSubscription;
 * ```
 *
 * @returns PermissionFlags object with boolean flags for each permission
 */
export function usePermissions(): PermissionFlags {
  const { userRole } = useAuth();

  // TASK 8.1: Extract user_role from AuthProvider context
  // Task 4 already provides userRole in AuthProvider context from JWT claims or fallback query

  // Memoize permission calculation to prevent unnecessary recalculation
  const permissions = useMemo(() => {
    return calculatePermissions(userRole);
  }, [userRole]);

  return permissions;
}
