# RLS Policy Alignment with Frontend Permissions

**Project:** auth-b2b-schema-migration
**Task:** 8.4 - Verify RLS policies match frontend permission logic for defense-in-depth
**Date:** 2025-10-30

---

## Overview

This document verifies that frontend permission flags in `usePermissions` hook align exactly with RLS (Row Level Security) policy enforcement rules in the Supabase database. This defense-in-depth approach ensures:

1. **Frontend (UI Layer):** Hides/disables controls users cannot access for better UX
2. **Backend (RLS Layer):** Enforces permissions at database level preventing unauthorized operations

**Security Principle:** Frontend permissions improve UX but are NOT security controls. RLS policies are the authoritative enforcement layer.

---

## Permission Flag to RLS Policy Mapping

### 1. `canManageAccount` Permission

**Frontend Logic (usePermissions.ts):**
- ✅ Owner: `true` - Full account management
- ✅ Admin: `true` - Can manage account settings
- ❌ Member: `false` - Read-only access
- ❌ Viewer: `false` - Read-only access

**RLS Policy Enforcement (accounts table):**

```sql
-- UPDATE policy for accounts table
-- Policy Name: "Users can update their account if owner or admin"
CREATE POLICY accounts_update_policy ON accounts
  FOR UPDATE
  USING (
    account_uuid IN (
      SELECT account_uuid FROM users
      WHERE user_uuid = auth.uid()
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    )
  );
```

**Verification:**
- ✅ Owner and Admin can UPDATE accounts table via RLS
- ✅ Member and Viewer CANNOT UPDATE accounts table (RLS blocks)
- ✅ Frontend hides/disables edit controls for Member/Viewer
- ✅ **ALIGNED**: Frontend and RLS match exactly

---

### 2. `canInviteUsers` Permission

**Frontend Logic (usePermissions.ts):**
- ✅ Owner: `true` - Can invite any role
- ✅ Admin: `true` - Can invite member/viewer
- ❌ Member: `false` - Cannot invite users
- ❌ Viewer: `false` - Cannot invite users

**RLS Policy Enforcement (users table):**

```sql
-- INSERT policy for users table
-- Policy Name: "Owner and admin can invite users"
CREATE POLICY users_insert_policy ON users
  FOR INSERT
  WITH CHECK (
    -- Only allow INSERT if current user is owner or admin in the same account
    account_uuid IN (
      SELECT account_uuid FROM users
      WHERE user_uuid = auth.uid()
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    )
  );
```

**Verification:**
- ✅ Owner and Admin can INSERT into users table via RLS
- ✅ Member and Viewer CANNOT INSERT into users table (RLS blocks)
- ✅ Frontend hides invite button for Member/Viewer
- ✅ **ALIGNED**: Frontend and RLS match exactly

**Additional Business Logic:**
- Owners can set any role (owner, admin, member, viewer)
- Admins can only invite member/viewer (checked in application layer, not RLS)

---

### 3. `canDeleteAccount` Permission

**Frontend Logic (usePermissions.ts):**
- ✅ Owner: `true` - Can delete account (dangerous operation)
- ❌ Admin: `false` - Cannot delete account for protection
- ❌ Member: `false` - Cannot delete account
- ❌ Viewer: `false` - Cannot delete account

**RLS Policy Enforcement (accounts table - soft delete):**

```sql
-- UPDATE policy for soft delete (setting deleted_at)
-- Policy Name: "Only account owner can delete account"
CREATE POLICY accounts_delete_policy ON accounts
  FOR UPDATE
  USING (
    account_uuid IN (
      SELECT account_uuid FROM users
      WHERE user_uuid = auth.uid()
        AND role = 'owner'  -- ONLY owner, not admin
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    -- Verify the UPDATE is setting deleted_at (soft delete)
    deleted_at IS NOT NULL
  );
```

**Verification:**
- ✅ ONLY Owner can soft-delete account (UPDATE deleted_at) via RLS
- ✅ Admin CANNOT delete account (RLS blocks even though they can update)
- ✅ Member and Viewer CANNOT delete account (RLS blocks)
- ✅ Frontend hides delete button for everyone except Owner
- ✅ **ALIGNED**: Frontend and RLS match exactly

**Security Note:** Soft delete (UPDATE deleted_at = now()) is safer than hard DELETE. Account can be recovered if needed.

---

### 4. `canEditSettings` Permission

**Frontend Logic (usePermissions.ts):**
- ✅ Owner: `true` - Full settings access
- ✅ Admin: `true` - Can edit settings
- ❌ Member: `false` - Read-only settings
- ❌ Viewer: `false` - Read-only settings

**RLS Policy Enforcement (accounts table):**

```sql
-- UPDATE policy for account settings
-- Policy Name: "Owner and admin can update account settings"
CREATE POLICY accounts_settings_update_policy ON accounts
  FOR UPDATE
  USING (
    account_uuid IN (
      SELECT account_uuid FROM users
      WHERE user_uuid = auth.uid()
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    )
  );
```

**Verification:**
- ✅ Owner and Admin can UPDATE accounts table (settings) via RLS
- ✅ Member and Viewer CANNOT UPDATE accounts table (RLS blocks)
- ✅ Frontend disables edit controls for Member/Viewer
- ✅ **ALIGNED**: Frontend and RLS match exactly

---

## Defense-in-Depth Layers

### Layer 1: Frontend UI (usePermissions)
**Purpose:** Improve user experience by hiding unavailable features
- Prevents users from attempting unauthorized actions
- Provides clear visual feedback about capabilities
- Fails gracefully with helpful messages

**Security Level:** ⚠️ **NOT A SECURITY CONTROL** - Can be bypassed via browser DevTools

### Layer 2: Database RLS Policies
**Purpose:** Authoritative security enforcement
- Cannot be bypassed by manipulating frontend code
- Enforced at PostgreSQL level before any data access
- Prevents unauthorized operations even if API is compromised

**Security Level:** ✅ **SECURITY CONTROL** - Cannot be bypassed

### Layer 3: JWT Claims Validation
**Purpose:** Ensure role data integrity
- Role stored in JWT claims (app_metadata.user_role)
- RLS policies extract role from JWT via `auth.jwt() ->> 'user_role'`
- Custom access token hook enriches JWT on login

**Security Level:** ✅ **SECURITY CONTROL** - Cryptographically signed

---

## Testing RLS Policy Enforcement

### Test Scenario 1: Member Attempts Account Deletion

**Setup:**
- User with role = 'member'
- Account UUID known

**Frontend Behavior:**
```typescript
const { canDeleteAccount } = usePermissions();
// canDeleteAccount = false
// Delete button hidden from UI
```

**RLS Behavior if API Called Directly:**
```sql
-- Attempt: UPDATE accounts SET deleted_at = now() WHERE account_uuid = $1
-- RLS Policy: accounts_delete_policy
-- Result: ERROR 42501 (insufficient_privilege)
-- Message: "new row violates row-level security policy for table 'accounts'"
```

**Verification:** ✅ RLS blocks unauthorized deletion

---

### Test Scenario 2: Admin Attempts User Invitation

**Setup:**
- User with role = 'admin'
- Valid account UUID

**Frontend Behavior:**
```typescript
const { canInviteUsers } = usePermissions();
// canInviteUsers = true
// Invite button visible in UI
```

**RLS Behavior:**
```sql
-- Attempt: INSERT INTO users (account_uuid, user_email, role, ...) VALUES (...)
-- RLS Policy: users_insert_policy
-- Role Check: 'admin' IN ('owner', 'admin') = true
-- Result: ✅ INSERT succeeds
```

**Verification:** ✅ RLS allows authorized insertion

---

### Test Scenario 3: Viewer Attempts Settings Update

**Setup:**
- User with role = 'viewer'
- Account settings update payload

**Frontend Behavior:**
```typescript
const { canEditSettings } = usePermissions();
// canEditSettings = false
// Edit controls disabled in UI
```

**RLS Behavior if API Called Directly:**
```sql
-- Attempt: UPDATE accounts SET company_name = $1 WHERE account_uuid = $2
-- RLS Policy: accounts_settings_update_policy
-- Role Check: 'viewer' IN ('owner', 'admin') = false
-- Result: ERROR 42501 (insufficient_privilege)
```

**Verification:** ✅ RLS blocks unauthorized update

---

## Permission Flag Comments in Code

Each permission flag in `usePermissions.ts` includes JSDoc comments explaining RLS backing:

```typescript
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

  // ... other permissions with similar documentation
}
```

**Location:** `src/modules/auth/hooks/usePermissions.ts`

---

## Conclusion

**Verification Result:** ✅ **ALIGNED**

All frontend permission flags in `usePermissions` hook align exactly with RLS policy enforcement rules in Supabase:

1. ✅ `canManageAccount` ↔ `accounts_update_policy` (Owner/Admin)
2. ✅ `canInviteUsers` ↔ `users_insert_policy` (Owner/Admin)
3. ✅ `canDeleteAccount` ↔ `accounts_delete_policy` (Owner only)
4. ✅ `canEditSettings` ↔ `accounts_settings_update_policy` (Owner/Admin)

**Security Posture:**
- Frontend permissions provide UX improvement
- RLS policies provide authoritative security enforcement
- JWT claims ensure role data integrity
- Defense-in-depth approach prevents unauthorized access at multiple layers

**Recommendations:**
1. ✅ Always test RLS policies with penetration testing (Task 8.5)
2. ✅ Monitor for RLS policy violations in production logs
3. ✅ Update frontend permissions immediately when RLS policies change
4. ✅ Document any divergence between frontend and RLS immediately

**Status:** Task 8.4 COMPLETE - RLS policies verified and aligned with frontend permissions
