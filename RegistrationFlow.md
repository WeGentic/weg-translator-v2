# Registration Flow Documentation

**Application:** Tr-entic Desktop (Tauri 2.8.5 + React 19.2)
**Schema:** B2B Multi-Tenant Account Management
**Last Updated:** 2025-11-01
**Status:** Production Implementation

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Architecture Summary](#architecture-summary)
3. [Complete Registration Flow](#complete-registration-flow)
4. [Frontend Components](#frontend-components)
5. [State Management & Validation](#state-management--validation)
6. [Supabase Integration](#supabase-integration)
7. [Database Schema](#database-schema)
8. [RLS Policies & Security](#rls-policies--security)
9. [Edge Functions](#edge-functions)
10. [Error Handling](#error-handling)
11. [Post-Registration Setup](#post-registration-setup)
12. [Important Notes](#important-notes)

---

## High-Level Overview

The registration flow creates a complete B2B organization account with:

- **Account** (tenant/organization entity)
- **Admin User** (owner role with full permissions)
- **Trial Subscription** (14-day automatic trial)

**Key Characteristics:**

- **Multi-step wizard** (Company Info → Admin Credentials)
- **Real-time validation** with debounced email uniqueness checks
- **Immediate account provisioning** through Supabase without email confirmation gating
- **Atomic account creation** via database function
- **B2B schema** with global email uniqueness enforcement
- **RLS-enforced** tenant isolation from first query

---

## Architecture Summary

### Technology Stack

- **Frontend:** React 19.2 + TanStack Router + Zod validation
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Desktop:** Tauri 2.8.5 (Rust backend for local SQLite sync)
- **UI:** ShadCN v3.3.1 + TailwindCSS 4.1.1

### Data Flow

```
User Input (Registration Form)
    ↓
Frontend Validation (Zod schema)
    ↓
Supabase Auth (signUp with auto-confirm)
    ↓
Edge Function (register-organization)
    ↓
Database Function (create_account_with_admin)
    ↓
Account + User + Subscription Created
    ↓
JWT Claims Enriched (custom_access_token_hook)
    ↓
AuthProvider Loads User Context
    ↓
Local SQLite Profile Synced
```

---

## Complete Registration Flow

### Step-by-Step User Journey

#### 1. User Opens Registration Page

**Route:** `/register`

**File:** `src/router/routes/register.tsx`

```tsx
// Registration route configuration
export const Route = createRoute({
  path: '/register',
  component: RegistrationRoute,
});
```

**Component:** `src/modules/auth/routes/RegistrationRoute.tsx`

Renders the `RegistrationForm` component inside a layout.

---

#### 2. Multi-Step Form Presentation

**Component:** `src/modules/auth/components/RegistrationForm.tsx` (Lines 1-446)

The form uses `useRegistrationForm` hook for all state and logic.

**Steps:**
1. **Company Step** - Organization details (name, email, phone, address, tax ID)
2. **Admin Step** - Administrator credentials (email, password)

**Progress Indicator:** `RegistrationProgress` component shows current step.

---

#### 3. Company Information (Step 1)

**Component:** `src/modules/auth/components/forms/RegistrationCompanyStep.tsx`

**Fields Collected:**

| Field | Validation | Notes |
|-------|------------|-------|
| `companyName` | Required, max 100 chars | Organization name |
| `companyEmail` | Required, valid email, **must match admin email** | Primary contact |
| `companyPhone` | Required, valid E.164 format | Phone with country code |
| `companyAddress` | Required | Address with autocomplete |
| `companyTaxNumber` | Required, format validated | VAT/Tax ID with country-specific rules |

**Validation Schema:** `src/modules/auth/utils/validation/registrationSchema.ts`

```typescript
// Company-Admin email match validation (Lines 231-240)
const companyEmail = values.companyEmail.trim().toLowerCase();
const adminEmail = values.adminEmail.trim().toLowerCase();

if (companyEmail && adminEmail && companyEmail !== adminEmail) {
  addIssue(
    ctx,
    "companyEmail",
    "Company email must match your admin email"
  );
}
```

**Tax ID Validation:** `src/modules/auth/utils/validation/tax-number-rules.ts`

Supports country-specific VAT/Tax ID formats (EU VAT, UK VAT, US EIN, etc.).

---

#### 4. Admin Credentials (Step 2)

**Component:** `src/modules/auth/components/forms/RegistrationAdminStep.tsx`

**Fields Collected:**

| Field | Validation | Notes |
|-------|------------|-------|
| `adminEmail` | Required, valid email, globally unique | Real-time uniqueness check |
| `adminPassword` | Required, strength requirements | Min 8 chars, complexity rules |
| `adminPasswordConfirm` | Required, must match password | Confirmation field |

**Email Status Probe:** `src/modules/auth/hooks/controllers/useEmailStatusProbe.ts`

- **Debounced check** (500ms) for email uniqueness
- **Statuses:**
  - `idle` - No check performed
  - `checking` - Validation in progress
  - `available` - Email can be used
  - `registered` - Email already exists and must be recovered via login flow

**Password Policy:** `src/modules/auth/utils/passwordPolicy.ts`

```typescript
// Password requirements
{
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,
}
```

**Visual Feedback:**
- `PasswordStrengthMeter` - Visual strength indicator
- `PasswordRequirementsPanel` - Real-time requirement checklist

---

#### 5. Form Submission

**Hook:** `src/modules/auth/hooks/controllers/useRegistrationForm.ts` (Lines 490-533)

**Submission Handler:**

```typescript
const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  
  // 1. Validate all fields
  const validation = evaluateErrors(values, { phoneValue, hasPhoneDigits });
  setErrors(validation);
  setTouched(createAllTouchedRegistrationTouched());
  
  // 2. Check for blocking errors
  if (hasErrors) return;
  
  // 3. Check email probe status
  if (emailStatusProbe.status === 'registered') return;
  
  // 4. Build normalized payload
  const payload = buildSubmissionPayload();
  
  // 5. Submit to backend
  submitRegistration(payload);
};
```

**Payload Structure:** `src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` (Lines 35-58)

```typescript
interface NormalizedRegistrationPayload {
  admin: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  };
  company: {
    name: string;
    email: string;  // Must match admin.email
    phone: string;
    taxId: string;
    taxCountryCode?: string;
    address: {
      freeform: string;
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      countryCode?: string | null;
    };
  };
}
```

---

#### 6. Supabase Auth SignUp

**Hook:** `useRegistrationSubmission.ts` (Lines 738-960)

**Phase:** `signingUp`

```typescript
// Supabase Auth signup call (Lines 901-911)
const { data, error } = await supabase.auth.signUp({
  email: payload.admin.email,
  password: payload.admin.password,
  options: {
    data: {
      company_name: payload.company.name,
      company_phone: payload.company.phone,
      tax_id: payload.company.taxId,
    },
  },
});
```

**Outcomes:**

1. **New User Created:**
   - State → `persisting`
   - No email confirmation is required; the sign-up response includes an authenticated session
   - Immediately proceeds to `persistRegistration(payload, attemptId, supabaseUser.id)`

2. **Email Already Exists:**
   - Triggers `resumeExistingAccount()` flow (Lines 747-897)
   - Attempts sign-in with provided password
   - If password correct → proceeds directly to persistence
   - If credentials fail → returns error prompting login recovery

3. **Error:**
   - Maps to user-friendly `SubmissionError`
   - Displays toast notification
   - Returns to form for correction

---

#### 7. Account Persistence (Database Creation)

**Phase:** `persisting`

**Function:** `persistRegistration()` (Lines 379-512)

**Steps:**

1. **Validate Email Match:**
   ```typescript
   if (payload.company.email !== payload.admin.email) {
     return { kind: "error", error: "email_mismatch" };
   }
   ```

2. **Call Edge Function:**
   ```typescript
   const { data, error } = await supabase.functions.invoke("register-organization", {
     body: {
       company_name: payload.company.name,
       company_email: payload.company.email,
       first_name: payload.admin.first_name ?? null,
       last_name: payload.admin.last_name ?? null,
       correlationId,
     },
     headers: {
       "x-correlation-id": correlationId,
     },
   });
   ```

3. **Edge Function Processing** (see [Edge Functions](#edge-functions) section)

4. **Success Response:**
   ```typescript
   {
     success: true,
     account_uuid: "uuid-here",
     user_uuid: "uuid-here",
     subscription_uuid: "uuid-here",
     correlationId: "correlation-id",
   }
   ```

---

#### 8. Orphan Detection Check

**Purpose:** Verify account was created correctly and user has valid membership

**Function:** `checkIfOrphaned()` via `src/modules/auth/utils/orphanDetection.ts`

**Check:** Queries `public.users` table to confirm:
- User record exists (`user_uuid`)
- Has valid `account_uuid`
- Account not soft-deleted
- User not soft-deleted

**Outcomes:**

- **Not Orphaned:** Proceed to success
- **Orphaned:** Log warning (unexpected in normal flow)

**Performance:** Target <200ms (43% faster than legacy multi-query approach)

---

#### 9. Registration Success

**Phase:** `succeeded`

**State Update:**
```typescript
dispatch({
  type: "success",
  result: {
    accountUuid,
    userUuid,
    subscriptionUuid,
    payload,
  },
});
```

**User Feedback:**
```typescript
toast({
  title: "Registration complete",
  description: `Your organization "${payload.company.name}" has been created successfully. You have been assigned as the owner.`,
});
```

**Dialog Display:** `RegistrationVerificationDialog` (legacy name) shows provisioning progress and success state

**User Action:** Clicks "Continue to Login" button

**Navigation:** Redirects to `/login` with success message

---

## Frontend Components

### Registration Route

**File:** `src/modules/auth/routes/RegistrationRoute.tsx`

Entry point for registration flow, renders `RegistrationForm`.

### Registration Form

**File:** `src/modules/auth/components/RegistrationForm.tsx` (446 lines)

**Key Features:**

- Multi-step wizard (2 steps)
- Progress indicator with step validation
- Real-time email status probing
- Completion dialog management
- Navigation controls (Back/Continue/Submit)

**State Management:** Delegates to `useRegistrationForm` hook

### Step Components

#### Company Step

**File:** `src/modules/auth/components/forms/RegistrationCompanyStep.tsx`

**Fields:**
- Company Name
- Company Email
- Company Phone (with country selector)
- Company Address (with autocomplete via Google Places API)
- Tax Number (with country-specific validation)

**Features:**
- Phone input with country code detection
- Address autocomplete with country inference for tax validation
- Real-time VAT/Tax ID format validation

#### Admin Step

**File:** `src/modules/auth/components/forms/RegistrationAdminStep.tsx`

**Fields:**
- Admin Email
- Admin Password
- Confirm Password

**Features:**
- Email status banner (shows if email exists)
- Password strength meter
- Password requirements checklist
- Real-time validation feedback

### Support Components

#### Password Strength Meter

**File:** `src/modules/auth/components/forms/PasswordStrengthMeter.tsx`

Visual progress bar showing password strength (weak/fair/good/strong).

#### Password Requirements Panel

**File:** `src/modules/auth/components/forms/PasswordRequirementsPanel.tsx`

Checklist of password requirements with check/cross icons.

#### Email Status Banner

**File:** `src/modules/auth/components/forms/EmailStatusBanner.tsx`

Shows email availability status with action buttons.

#### Registration Progress

**File:** `src/modules/auth/components/forms/RegistrationProgress.tsx`

Step indicator showing current/completed/incomplete steps.

#### Registration Completion Dialog

**File:** `src/modules/auth/components/dialog/RegistrationVerificationDialog.tsx`

- Legacy component name retained for compatibility
- Displays a blocking modal while persistence executes
- Surfaces success messaging and next steps once account provisioning completes

## State Management & Validation

### Registration Form Hook

**File:** `src/modules/auth/hooks/controllers/useRegistrationForm.ts` (707 lines)

**Responsibilities:**

1. **Form State:**
   - Field values
   - Touched state
   - Validation errors
   - Current step index

2. **Computed State:**
   - Step validity
   - Form validity
   - Blocking fields per step
   - Tooltip messages

3. **Handlers:**
   - Field change/blur
   - Phone input (with country detection)
   - Address autocomplete
   - Step navigation
   - Form submission

4. **Integrations:**
   - Email status probe
   - Registration submission
   - Password evaluation
   - Address autocomplete

**Key Features:**

- **Real-time validation** on every field change
- **Step-based validation** prevents advancing with errors
- **Phone normalization** to E.164 format
- **Address geocoding** infers country for tax validation
- **Email probe** debounced to 500ms

### Registration Submission Hook

**File:** `src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` (1000 lines)

**State Machine:**

```typescript
type SubmissionPhase =
  | "idle"           // Initial state
  | "signingUp"      // Calling supabase.auth.signUp()
  | "persisting"     // Calling Edge Function
  | "succeeded"      // Account created
  | "failed";        // Error occurred
```

**Reducer-Based State:**

```typescript
interface SubmissionState {
  phase: SubmissionPhase;
  attemptId: string | null;       // Correlation ID
  error: SubmissionError | null;
  adminUuid: string | null;
  payload: NormalizedRegistrationPayload | null;
  result: SubmissionSuccessResult | null;
}
```

- **Key Functions:**

- `submit(payload)` - Initiates registration
- `resumeExistingAccount()` - Handles prior registrations detected by the email probe
- `reset()` - Resets to idle state
- `persistRegistration()` - Calls Edge Function
- Successful sign-up transitions the reducer directly to `"persisting"`; there is no intermediate polling lifecycle.

### Email Status Probe Hook

**File:** `src/modules/auth/hooks/controllers/useEmailStatusProbe.ts`

**Purpose:** Real-time email uniqueness checking

**Debounce:** 500ms after last keystroke

**Query:** Checks `public.users` table for `user_email`

**States:**

```typescript
type EmailStatus =
  | 'idle'                    // No check performed
  | 'checking'                // Query in progress
  | 'available'               // Email not registered
  | 'registered';             // Email already registered
```

**Actions:**

- **registered:** Block submission and direct user to login or recovery
- **available:** Allow submission

### Validation Schema

**File:** `src/modules/auth/utils/validation/registrationSchema.ts` (277 lines)

**Zod-Based Validation:**

```typescript
// Main registration schema (Lines 214-242)
const schema = z.object({
  companyName: z.string(),
  companyAddress: z.string(),
  companyEmail: z.string(),
  companyPhone: z.string(),
  companyTaxNumber: z.string(),
  adminEmail: z.string(),
  adminPassword: z.string(),
  adminPasswordConfirm: z.string(),
}).superRefine((values, ctx) => {
  runCompanyChecks(values, ctx, options);
  runAdminChecks(values, ctx);
  
  // Critical: Company email must match admin email
  const companyEmail = values.companyEmail.trim().toLowerCase();
  const adminEmail = values.adminEmail.trim().toLowerCase();
  
  if (companyEmail && adminEmail && companyEmail !== adminEmail) {
    addIssue(ctx, "companyEmail", "Company email must match your admin email");
  }
});
```

**Company Validation Rules:**

| Field | Validation |
|-------|------------|
| `companyName` | Required, max 100 characters |
| `companyEmail` | Required, valid email, must match admin email |
| `companyPhone` | Required, valid E.164 format via `libphonenumber-js` |
| `companyAddress` | Required |
| `companyTaxNumber` | Required, country-specific format |

**Admin Validation Rules:**

| Field | Validation |
|-------|------------|
| `adminEmail` | Required, valid email, globally unique |
| `adminPassword` | Required, min 8 chars, strength requirements |
| `adminPasswordConfirm` | Required, must match password |

**Tax Number Validation:** `src/modules/auth/utils/validation/tax-number-rules.ts`

Supports:
- EU VAT (AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GR, HR, HU, IE, IT, LT, LU, LV, MT, NL, PL, PT, RO, SE, SI, SK)
- UK VAT
- US EIN
- CH UID
- And more...

**Validation Flow:**

```typescript
// 1. Tax number format check
const taxResult = validateTaxNumberFormat({
  value: taxNumber,
  countryCode: taxCountryCode, // Inferred from address
});

// 2. Handle result
if (taxResult.kind === "invalid_format") {
  addIssue(ctx, "companyTaxNumber", taxResult.message);
} else if (taxResult.kind === "unsupported") {
  addIssue(ctx, "companyTaxNumber", "Tax number validation not available for selected country");
}
```

---

## Supabase Integration

### Supabase Client Configuration

**File:** `src/core/config/supabaseClient.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

### Supabase Auth Flow

#### 1. Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'admin@example.com',
  password: 'SecurePassword123',
  options: {
    data: {
      company_name: 'Example Corp',
      company_phone: '+15551234567',
      tax_id: 'US123456789',
    },
  },
});
```

**Result:**

- Creates record in `auth.users` table with `email_confirmed_at` auto-populated
- Returns an active session because email confirmation is disabled for registration

#### 2. Session Management

**AuthProvider:** `src/app/providers/auth/AuthProvider.tsx` (660 lines)

```typescript
// Get session on mount
const { data } = await supabase.auth.getSession();
setSession(data.session);

// Subscribe to auth state changes
supabase.auth.onAuthStateChange((_event, nextSession) => {
  setSession(nextSession);
});
```

**Session Object:**

```typescript
{
  access_token: "jwt-token-here",
  refresh_token: "refresh-token-here",
  user: {
    id: "user-uuid",
    email: "admin@example.com",
    email_confirmed_at: "2025-11-01T12:00:00Z",
    app_metadata: {
      account_uuid: "account-uuid",  // Added by custom_access_token_hook
      user_role: "owner",             // Added by custom_access_token_hook
    },
  },
}
```

### Custom Access Token Hook

**Purpose:** Add `account_uuid` and `user_role` to JWT claims for efficient RLS

**Database Function:** (from `docs/supabase_account_schemas/account-schemas.md`)

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_account_uuid uuid;
  user_role_value text;
BEGIN
  -- Fetch account_uuid and role from users table
  SELECT account_uuid, role INTO user_account_uuid, user_role_value
  FROM public.users
  WHERE user_uuid = (event->>'user_id')::uuid
    AND deleted_at IS NULL;

  -- Add claims to JWT app_metadata
  event := jsonb_set(event, '{claims,app_metadata,account_uuid}', to_jsonb(user_account_uuid));
  event := jsonb_set(event, '{claims,app_metadata,user_role}', to_jsonb(user_role_value));

  RETURN event;
END;
$$;
```

**Configuration:** Supabase Dashboard → Authentication → Hooks → Custom Access Token

**URI:** `pg-functions://postgres/public/custom_access_token_hook`

**Performance Impact:**

| Metric | Without Hook | With Hook | Improvement |
|--------|-------------|-----------|-------------|
| Login flow | ~1800ms | ~950ms | 47% faster |
| Account queries | ~180ms | ~40ms | 78% faster |
| Orphan detection | ~150ms | ~85ms | 43% faster |

**Fallback Behavior:** If hook not configured, `AuthProvider` queries `public.users` table (adds 50-100ms latency)

### Supabase Queries

**User Queries:** `src/core/supabase/queries/users.ts` (328 lines)

```typescript
export class UserQueries {
  // Get user by UUID
  static async getUser(userUuid: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_uuid', userUuid)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw mapSupabaseError(error);
    return data;
  }

  // Get current authenticated user
  static async getCurrentUser(): Promise<User | null> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_uuid', authUser.id)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw mapSupabaseError(error);
    return data;
  }

  // List users in account
  static async listAccountUsers(accountUuid: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('account_uuid', accountUuid)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw mapSupabaseError(error);
    return data || [];
  }
}
```

**Account Queries:** `src/core/supabase/queries/accounts.ts` (227 lines)

```typescript
export class AccountQueries {
  // Get account by UUID
  static async getAccount(accountUuid: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_uuid', accountUuid)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw mapSupabaseError(error);
    return data;
  }

  // Update account
  static async updateAccount(
    accountUuid: string,
    payload: AccountUpdatePayload
  ): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .update(payload)
      .eq('account_uuid', accountUuid)
      .is('deleted_at', null)
      .select()
      .maybeSingle();
    
    if (error) throw mapSupabaseError(error);
    return data;
  }
}
```

**Subscription Queries:** `src/core/supabase/queries/subscriptions.ts`

Used post-registration to check trial status and expiry.

---

## Database Schema

### B2B Multi-Tenant Model

**Documentation:** `docs/supabase_account_schemas/account-schemas.md`

**Schema Overview:**

```
┌─────────────────┐
│    accounts     │  ← Tenant/Organization
├─────────────────┤
│ account_uuid PK │
│ company_name    │
│ company_email   │
│ created_at      │
│ modified_at     │
│ deleted_at      │  ← Soft delete
└─────────────────┘
         │
         │ 1:N
         ↓
┌─────────────────┐
│      users      │  ← Application users
├─────────────────┤
│ user_uuid PK    │ → FK to auth.users.id CASCADE
│ account_uuid FK │ → FK to accounts
│ user_email      │ ← UNIQUE (global)
│ role            │ ← owner|admin|member|viewer
│ first_name      │
│ last_name       │
│ avatar_url      │
│ created_at      │
│ modified_at     │
│ deleted_at      │  ← Soft delete
└─────────────────┘
         │
         │ 1:N
         ↓
┌─────────────────────┐
│   subscriptions     │  ← Account subscriptions
├─────────────────────┤
│ subscription_uuid PK│
│ account_uuid FK     │
│ status              │ ← trialing|active|past_due|canceled|unpaid
│ plan_id             │
│ trial_ends_at       │ ← now() + interval '14 days'
│ current_period_start│
│ current_period_end  │
│ created_at          │
│ modified_at         │
│ deleted_at          │  ← Soft delete
└─────────────────────┘
```

### Accounts Table

**Purpose:** Top-level tenant entity representing the organization

```sql
CREATE TABLE public.accounts (
  account_uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  
  company_name text NOT NULL,
  company_email text,
  
  CONSTRAINT accounts_pkey PRIMARY KEY (account_uuid),
  CONSTRAINT accounts_company_name_check CHECK (char_length(company_name) >= 2)
);
```

**Indexes:**

```sql
CREATE INDEX idx_accounts_deleted_at ON public.accounts(deleted_at) WHERE deleted_at IS NULL;
```

**Triggers:**

```sql
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Users Table

**Purpose:** Application user profiles with account membership and role

```sql
CREATE TABLE public.users (
  user_uuid uuid NOT NULL,  -- References auth.users(id)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  
  account_uuid uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  
  first_name text,
  last_name text,
  user_email text NOT NULL,  -- Denormalized from auth.users.email
  avatar_url text,
  
  is_active boolean DEFAULT true,
  
  CONSTRAINT users_pkey PRIMARY KEY (user_uuid),
  CONSTRAINT users_account_uuid_fkey 
    FOREIGN KEY (account_uuid) 
    REFERENCES public.accounts(account_uuid) ON DELETE CASCADE,
  CONSTRAINT users_user_uuid_fkey 
    FOREIGN KEY (user_uuid) 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT users_user_email_unique UNIQUE (user_email),
  CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);
```

**Critical Constraints:**

- `user_email UNIQUE` - **Global email uniqueness** (breaking change from legacy)
- `account_uuid NOT NULL` - Every user must belong to an account
- CASCADE deletes - Deleting auth user cascades to users table

**Indexes:**

```sql
CREATE INDEX idx_users_account_uuid ON public.users(account_uuid);
CREATE INDEX idx_users_email ON public.users(user_email);
CREATE INDEX idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;
```

**Triggers:**

```sql
-- Auto-update modified_at
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Sync email from auth.users
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();
```

### Subscriptions Table

**Purpose:** Account subscription status and trial management

```sql
CREATE TABLE public.subscriptions (
  subscription_uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  
  account_uuid uuid NOT NULL,
  status text NOT NULL DEFAULT 'trialing',
  plan_id text DEFAULT 'trial',
  
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  
  CONSTRAINT subscriptions_pkey PRIMARY KEY (subscription_uuid),
  CONSTRAINT subscriptions_account_uuid_fkey 
    FOREIGN KEY (account_uuid) 
    REFERENCES public.accounts(account_uuid) ON DELETE CASCADE,
  CONSTRAINT subscriptions_status_check 
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid'))
);
```

**Unique Constraint:**

```sql
-- Only one active subscription per account
CREATE UNIQUE INDEX idx_subscriptions_active_account 
  ON public.subscriptions(account_uuid) 
  WHERE status IN ('trialing', 'active') AND deleted_at IS NULL;
```

**Indexes:**

```sql
CREATE INDEX idx_subscriptions_account_uuid ON public.subscriptions(account_uuid);
CREATE INDEX idx_subscriptions_expires_at ON public.subscriptions(trial_ends_at);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
```

### Create Account With Admin Function

**Purpose:** Atomically create account, admin user, and trial subscription

**Location:** `docs/supabase_account_schemas/account-schemas.md` (Lines 144-230)

```sql
CREATE OR REPLACE FUNCTION public.create_account_with_admin(
  p_company_name text,
  p_company_email text,
  p_admin_first_name text DEFAULT NULL,
  p_admin_last_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_uuid uuid;
  v_user_uuid uuid;
  v_user_email text;
  v_subscription_uuid uuid;
BEGIN
  -- Get the authenticated user's ID and email
  v_user_uuid := auth.uid();
  v_user_email := (SELECT email FROM auth.users WHERE id = v_user_uuid);
  
  -- Validate user is authenticated
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user already belongs to an account
  IF EXISTS (SELECT 1 FROM public.users WHERE user_uuid = v_user_uuid) THEN
    RAISE EXCEPTION 'User already belongs to an account';
  END IF;
  
  -- Create the account
  INSERT INTO public.accounts (company_name, company_email, is_active)
  VALUES (p_company_name, p_company_email, true)
  RETURNING account_uuid INTO v_account_uuid;
  
  -- Create the admin user profile
  INSERT INTO public.users (
    user_uuid,
    account_uuid,
    role,
    user_email,
    first_name,
    last_name,
    is_active
  )
  VALUES (
    v_user_uuid,
    v_account_uuid,
    'owner',  -- First user is always owner
    v_user_email,
    p_admin_first_name,
    p_admin_last_name,
    true
  );
  
  -- Create trial subscription
  INSERT INTO public.subscriptions (
    account_uuid,
    subscription_type,
    status,
    trial_ends_at
  )
  VALUES (
    v_account_uuid,
    'trial',
    'trialing',
    now() + interval '14 days'
  )
  RETURNING subscription_uuid INTO v_subscription_uuid;
  
  -- Return the created account info
  RETURN json_build_object(
    'account_uuid', v_account_uuid,
    'user_uuid', v_user_uuid,
    'subscription_uuid', v_subscription_uuid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_account_with_admin TO authenticated;
```

**Transaction Safety:**

- All operations in single atomic transaction
- Rollback on any error
- No partial account creation possible

**Security:**

- `SECURITY DEFINER` - Runs with function owner privileges (bypasses RLS)
- Checks `auth.uid()` - Must be authenticated
- Validates no existing account membership
- Sets first user as `owner` role

---

## RLS Policies & Security

### Row Level Security (RLS)

**All tables have RLS enabled:**

```sql
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
```

### Accounts Policies

**File:** `supabase/migrations/20250130000004_final_rls_fix_with_security_definer.sql`

#### Users can view own account

```sql
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
```

**Explanation:**

- User must be authenticated (`auth.uid() IS NOT NULL`)
- Account UUID must match user's account
- Tries JWT claims first (optimal)
- Falls back to SECURITY DEFINER function (safe fallback)
- Filters soft-deleted accounts

#### Owners and admins can update account

```sql
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
```

**Explanation:**

- User must be authenticated
- Account UUID must match user's account
- User role must be `owner` or `admin`
- Tries JWT claims first, falls back to function
- Filters soft-deleted accounts

### Users Policies

#### Users can view own user record

```sql
CREATE POLICY "Users can view own user record"
  ON public.users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND user_uuid = auth.uid()
    AND deleted_at IS NULL
  );
```

#### Users can view same account users

```sql
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
```

**Explanation:**

- Users can see other users in their account
- RLS ensures cross-account isolation
- Soft-deleted users filtered out

#### Owners and admins can invite users

```sql
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
```

#### Users can update own profile

```sql
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND user_uuid = auth.uid()
  )
  WITH CHECK (
    user_uuid = auth.uid()
  );
```

**Note:** Prevents users from changing their `account_uuid` or elevating their `role`

#### Owners and admins can update users in account

```sql
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
```

### Subscriptions Policies

#### Users can view own account subscription

```sql
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
```

#### Owners can update subscriptions

```sql
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
```

**Note:** Only owners can modify subscriptions

#### System can insert subscriptions

```sql
CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);
```

**Explanation:**

- Subscriptions created by `create_account_with_admin()` function
- Function runs as SECURITY DEFINER, bypassing RLS
- No direct user insertion allowed

### Security Definer Helper Function

**Purpose:** Break RLS recursion cycle for fallback queries

```sql
CREATE OR REPLACE FUNCTION public.get_current_user_account_info()
RETURNS TABLE (
  account_uuid uuid,
  user_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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
```

**Key Features:**

- `SECURITY DEFINER` - Runs with function owner privileges (bypasses RLS)
- `STABLE` - Result cached within transaction (performance)
- Only returns data for `auth.uid()` (security)
- Prevents infinite recursion when RLS policies query users table

**Grant Permissions:**

```sql
GRANT EXECUTE ON FUNCTION public.get_current_user_account_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_account_info() TO anon;
```

---

## Edge Functions

### register-organization Edge Function

**File:** `supabase/functions/register-organization/index.ts` (347 lines)

**Purpose:** Validate request, verify user, call `create_account_with_admin()` database function

**Flow:**

```
1. OPTIONS request → Return CORS headers
2. GET request → Return health check
3. POST request → Process registration
   ↓
4. Validate Authorization header (Bearer token)
   ↓
5. Parse and validate JSON body (Zod schema)
   ↓
6. Ensure user is authenticated with a valid session token
   ↓
7. Call create_account_with_admin() database function
   ↓
8. Handle PostgreSQL errors (unique constraint violations, etc.)
   ↓
9. Return success response with UUIDs
```

**Request Validation:**

```typescript
const registrationSchema = z.object({
  correlationId: z.string().uuid().optional(),
  company_name: z.string().min(1, "Company name is required."),
  company_email: z.string().email("Company email must be valid."),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
});
```

**User Authentication:**

```typescript
async function getAuthenticatedUser(token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { error: { code: "invalid_token", message: "Authorization token is invalid or expired." } };
  }

  const user = data.user;
  return { user };
}
```

**Database Function Call:**

```typescript
const { data, error } = await supabase.rpc("create_account_with_admin", {
  p_company_name: payload.company_name,
  p_company_email: payload.company_email.toLowerCase(),
  p_admin_first_name: payload.first_name || null,
  p_admin_last_name: payload.last_name || null,
});

if (error) throw error;
```

**Error Mapping:**

```typescript
function normalizeDbError(error: unknown, correlationId: string) {
  const pgErr = error as PgError;
  const code = pgErr?.code;

  // 23505 = unique_violation (email already exists)
  if (code === "23505") {
    return {
      status: 409,
      body: {
        error: {
          code: "EMAIL_EXISTS",
          message: "This email is already registered. Please login or use a different email.",
          details: { constraint: pgErr.constraint, detail: pgErr.detail },
          correlationId,
        },
      },
    };
  }

  // 23503 = foreign_key_violation
  // 23514 = check_violation
  if (code === "23503" || code === "23514") {
    return {
      status: 422,
      body: {
        error: {
          code: "invalid_reference",
          message: "Submitted data violates database constraints.",
          details: { constraint: pgErr.constraint, detail: pgErr.detail },
          correlationId,
        },
      },
    };
  }

  // 40001 = serialization_failure
  // 40P01 = deadlock_detected
  if (code === "40001" || code === "40P01") {
    return {
      status: 503,
      body: {
        error: {
          code: "retry_required",
          message: "Database contention detected. Please retry the registration.",
          correlationId,
        },
      },
    };
  }

  // 57014 = query_canceled
  // 57P01 = admin_shutdown
  if (code === "57014" || code === "57P01") {
    return {
      status: 500,
      body: {
        error: {
          code: "database_timeout",
          message: "Registration request timed out. Please try again.",
          correlationId,
        },
      },
    };
  }

  // Fallback
  return {
    status: 500,
    body: {
      error: {
        code: "unhandled_error",
        message: pgErr?.message || "Unexpected server error.",
        details: { detail: pgErr?.detail, constraint: pgErr?.constraint },
        correlationId,
      },
    },
  };
}
```

**Success Response:**

```typescript
return jsonResponse(
  {
    success: true,
    account_uuid: data.account_uuid,
    user_uuid: data.user_uuid,
    subscription_uuid: data.subscription_uuid,
    correlationId,
  },
  201,
  correlationId
);
```

**HTTP Status Codes:**

| Code | Scenario | Error Code |
|------|----------|------------|
| 201 | Success | - |
| 400 | Invalid JSON | `invalid_json` |
| 401 | Missing/invalid token | `missing_token`, `invalid_token` |
| 409 | Email already exists | `EMAIL_EXISTS` |
| 422 | Validation failed | `validation_failed` |
| 422 | Constraint violation | `invalid_reference` |
| 500 | Database error | `database_timeout`, `unhandled_error` |
| 503 | Database contention | `retry_required` |

**Correlation ID:**

All responses include `x-correlation-id` header for request tracing:

```typescript
const correlationId = 
  req.headers.get("x-correlation-id") || 
  payload.correlationId || 
  crypto.randomUUID();
```

**CORS Headers:**

```typescript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json",
};
```

---

## Error Handling

### Frontend Error Types

#### SubmissionError

**File:** `src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` (Lines 28-33)

```typescript
export interface SubmissionError {
  code: string;
  message: string;
  source: "supabase" | "network" | "unknown";
  details?: unknown;
}
```

**Error Mapping Functions:**

1. **mapAuthError** (Lines 152-165)
   - Maps Supabase AuthError to SubmissionError
   - Extracts status code and message
   - Source: `"supabase"`

2. **isEmailNotConfirmedError** (Lines 167-178)
   - Legacy guard that detects "email not confirmed" responses
   - Checks status 400 and message content
   - Surfaces a user-friendly recovery path if a stale project setting reintroduces verification

3. **isUserAlreadyExistsError** (Lines 180-192)
   - Detects "user already exists" errors
   - Checks error code and message
   - Triggers resume flow

4. **mapFunctionInvokeError** (Lines 235-292)
   - Maps Edge Function errors to SubmissionError
   - Handles HTTP status codes (409, 401, 500, etc.)
   - Source: `"network"`

5. **mapUnknownError** (Lines 198-213)
   - Fallback for unexpected errors
   - Extracts message if available
   - Source: `"unknown"`

**Error Display:**

```typescript
toast({
  variant: "destructive",
  title: "Registration failed",
  description: submissionError.message,
});
```

### Backend Error Codes

**PostgreSQL Error Codes:**

| Code | Name | Meaning | HTTP Status |
|------|------|---------|-------------|
| 23505 | unique_violation | Email already exists | 409 Conflict |
| 23503 | foreign_key_violation | Invalid account reference | 422 Unprocessable |
| 23514 | check_violation | Constraint check failed | 422 Unprocessable |
| 40001 | serialization_failure | Database contention | 503 Service Unavailable |
| 40P01 | deadlock_detected | Database deadlock | 503 Service Unavailable |
| 57014 | query_canceled | Query timeout | 500 Internal Server Error |
| 57P01 | admin_shutdown | Database shutdown | 500 Internal Server Error |

**Application Error Codes:**

| Code | HTTP Status | User Message |
|------|-------------|--------------|
| `EMAIL_EXISTS` | 409 | "This email is already registered. Please login or use a different email." |
| `invalid_token` | 401 | "Authorization token is invalid or expired." |
| `missing_token` | 401 | "Authorization header with Bearer token is required." |
| `validation_failed` | 422 | "Submitted data is invalid." |
| `invalid_reference` | 422 | "Submitted data violates database constraints." |
| `retry_required` | 503 | "Database contention detected. Please retry the registration." |
| `database_timeout` | 500 | "Registration request timed out. Please try again." |
| `unhandled_error` | 500 | "Unexpected server error." |

### Error Recovery Flows

#### 1. Email Already Exists

**Scenario:** User tries to register with an email that already has an account.

**Detection:**
- Email status probe returns `registered`
- OR Supabase Auth returns "user already exists" error

**Recovery:**
- **Email Probe:** Show "Email in use" banner with direct navigation to login or recovery
- **Auth Error:** Attempt sign-in with provided password
  - **Success:** Resume registration flow (persistence phase)
  - **Failure:** Show "Incorrect password" error with recovery option

#### 2. Network/Timeout Errors

**Scenario:** Edge Function call fails due to network or timeout

**Detection:**
- `FunctionsHttpError`, `FunctionsRelayError`, `FunctionsFetchError`
- HTTP 500 or 503 status codes

**Recovery:**
- Show error toast with "Please try again" message
- User can retry submission
- Form state preserved
- Correlation ID logged for debugging

#### 4. Validation Errors

**Scenario:** Frontend validation passed but backend validation fails

**Detection:**
- HTTP 422 status code
- `validation_failed` error code

**Recovery:**
- Display specific field errors
- Highlight invalid fields
- User corrects and resubmits

#### 5. Database Constraint Violations

**Scenario:** Database constraint violated (e.g., email uniqueness at DB level)

**Detection:**
- PostgreSQL error code 23505 (unique_violation)
- HTTP 409 status code

**Recovery:**
- Show "Email already registered" error
- Suggest login or different email
- Provide navigation to login page

---

## Post-Registration Setup

### 1. AuthProvider User Enrichment

**File:** `src/app/providers/auth/AuthProvider.tsx`

**Function:** `mapUserWithProfile()` (Lines 183-224)

**Purpose:** Enrich authenticated user with profile data from `public.users` table

**Flow:**

```typescript
async function mapUserWithProfile(supabaseUser: SupabaseUser | null) {
  if (!supabaseUser) return null;

  const baseUser = mapUser(supabaseUser);
  
  try {
    // Fetch user record from public.users
    const userRecord = await UserQueries.getUser(supabaseUser.id);
    
    // Extract account context from JWT claims with fallback
    const accountContext = await extractAccountContext(supabaseUser);
    
    if (userRecord) {
      return {
        ...baseUser,
        fullName: userRecord.first_name && userRecord.last_name
          ? `${userRecord.first_name} ${userRecord.last_name}`
          : null,
        avatarUrl: userRecord.avatar_url,
        accountUuid: accountContext.accountUuid || userRecord.account_uuid,
        userRole: accountContext.userRole || userRecord.role,
      };
    }
    
    // No record found - return base user with JWT context
    return {
      ...baseUser,
      accountUuid: accountContext.accountUuid,
      userRole: accountContext.userRole,
    };
  } catch (error) {
    logger.warn("Failed to fetch user data during login", { error });
    return baseUser;
  }
}
```

**JWT Claims Extraction:** `extractAccountContext()` (Lines 86-176)

```typescript
async function extractAccountContext(supabaseUser: SupabaseUser) {
  // Try JWT claims first (optimal)
  const jwtAccountUuid = supabaseUser.app_metadata?.account_uuid;
  const jwtUserRole = supabaseUser.app_metadata?.user_role;
  
  if (jwtAccountUuid && jwtUserRole) {
    // Validate role
    const allowedRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!allowedRoles.includes(jwtUserRole)) {
      logger.warn("Invalid user role from JWT, defaulting to 'member'");
      return { accountUuid: jwtAccountUuid, userRole: 'member' };
    }
    
    return { accountUuid: jwtAccountUuid, userRole: jwtUserRole };
  }
  
  // Fallback: Query users table
  logger.warn("Custom access token hook not configured. Performance degraded.");
  
  try {
    const user = await UserQueries.getUser(supabaseUser.id);
    if (!user) return { accountUuid: null, userRole: null };
    
    return { accountUuid: user.account_uuid, userRole: user.role };
  } catch (error) {
    logger.error("Failed to execute fallback query for account context");
    return { accountUuid: null, userRole: null };
  }
}
```

### 2. Orphan Detection Post-Registration

**Purpose:** Verify account creation succeeded and user has valid membership

**Function:** `checkIfOrphaned()` from `src/modules/auth/utils/orphanDetection.ts`

**Called From:** `useRegistrationSubmission.ts` (Lines 647-673)

```typescript
// Post-registration orphan check
try {
  const orphanCheck = await checkIfOrphaned(supabaseUser.id);
  
  logger.info("Post-registration orphan check completed", {
    attempt_id: attemptId,
    account_uuid: persistenceResult.accountUuid,
    user_uuid: persistenceResult.userUuid,
    subscription_uuid: persistenceResult.subscriptionUuid,
    orphaned: orphanCheck.orphaned,
    has_valid_account: orphanCheck.hasValidAccount,
  });
  
  if (orphanCheck.orphaned) {
    logger.warn("Post-registration orphan detected (unexpected)", {
      attempt_id: attemptId,
      user_uuid: persistenceResult.userUuid,
      orphan_type: orphanCheck.orphanType,
    });
  }
} catch (orphanError) {
  logger.warn("Post-registration orphan check failed (non-blocking)", {
    attempt_id: attemptId,
    user_uuid: persistenceResult.userUuid,
    error: orphanError.message,
  });
}
```

**Note:** Orphan check failure is non-blocking - registration still succeeds

**Orphan Types:**

| Type | Meaning | Expected Post-Registration? |
|------|---------|----------------------------|
| `no-users-record` | No record in `public.users` | ❌ No (indicates DB function failure) |
| `null-account-uuid` | User record exists but `account_uuid` is null | ❌ No (indicates DB function failure) |
| `deleted-user` | User has `deleted_at` timestamp | ❌ No (impossible for new user) |
| `deleted-account` | Account has `deleted_at` timestamp | ❌ No (impossible for new account) |

### 3. Local SQLite Profile Sync (Desktop App)

**File:** `src/app/providers/auth/AuthProvider.tsx` (Lines 537-648)

**Purpose:** Maintain local SQLite user profile for offline desktop features

**Triggered By:** `useEffect` on user state change

**Flow:**

```typescript
async function syncLocalUserProfile(currentUser: User | null) {
  if (!currentUser || !currentUser.emailVerified) return;
  
  const identifier = currentUser.id;
  
  // Map users table fields to SQLite schema
  const preferredName = currentUser.fullName || currentUser.name || currentUser.email;
  const roles = currentUser.userRole ? [currentUser.userRole] : ["member"];
  
  try {
    const existingProfile = await getUserProfile(identifier);
    
    if (!existingProfile) {
      // Create new profile
      await createUserProfile({
        userUuid: identifier,
        username: preferredName,
        email: currentUser.email,
        roles,
      });
      
      logger.info("Created local user profile (SQLite)", {
        user_uuid: identifier,
        account_uuid: currentUser.accountUuid,
        role: currentUser.userRole,
        syncedRoles: roles.join(', '),
      });
    } else {
      // Update existing profile if needed
      const needsUpdate = 
        existingProfile.username !== preferredName ||
        existingProfile.email !== currentUser.email ||
        JSON.stringify(existingProfile.roles) !== JSON.stringify(roles);
      
      if (needsUpdate) {
        await updateUserProfile({
          userUuid: identifier,
          username: preferredName,
          email: currentUser.email,
          roles,
        });
        
        logger.info("Updated local user profile (SQLite)", {
          user_uuid: identifier,
          account_uuid: currentUser.accountUuid,
          updatedFields: { name, email, roles },
        });
      }
    }
  } catch (error) {
    logger.error("Failed to sync local user profile (SQLite)", { error });
    // Non-blocking - will retry on next login
  }
}
```

**SQLite Schema Mapping:**

| Supabase (`public.users`) | SQLite (`users` table) |
|----------------------------|------------------------|
| `user_uuid` | `userUuid` |
| `user_email` | `email` |
| `first_name + last_name` | `username` |
| `role` (single value) | `roles` (array) |

**Note:** SQLite profile is for desktop-specific features only. Cloud profiles are managed by Supabase.

### 4. Subscription Status Initialization

**Hook:** `useSubscriptionStatus()` from `src/modules/auth/hooks/useSubscriptionStatus.ts`

**Usage:** `AuthProvider.tsx` (Lines 235-239)

```typescript
const {
  data: subscriptionStatus,
  isLoading: isSubscriptionLoading,
  error: subscriptionError,
} = useSubscriptionStatus(user?.accountUuid);
```

**Context Values:**

```typescript
{
  hasActiveSubscription: subscriptionStatus?.hasActiveSubscription ?? false,
  trialEndsAt: subscriptionStatus?.trial_ends_at ?? null,
  daysRemaining: subscriptionStatus?.daysRemaining ?? null,
}
```

**Caching:** 5-minute TTL via react-query (80%+ cache hit rate)

**Fail-Closed:** On error, `hasActiveSubscription = false`

---

## Important Notes

### Breaking Changes from Legacy Schema

#### 1. Global Email Uniqueness

**Old Schema:** Email unique per company (same email allowed in multiple accounts)

**New Schema:** Email globally unique across all accounts

```sql
CONSTRAINT users_user_email_unique UNIQUE (user_email)
```

**Impact:**
- User cannot register same email for multiple accounts
- Prevents cross-account contamination
- Enforces single-account-per-user model

**Workaround:** Use email aliases (`user+company1@domain.com`, `user+company2@domain.com`)

#### 2. One-to-One User-Account Relationship

**Old Schema:** Users can belong to multiple companies via `company_members` junction table

**New Schema:** Users belong to single account via `users.account_uuid` foreign key

**Impact:**
- No multi-account switching
- User membership determined by `account_uuid` field
- Account switching requires new user account

#### 3. Role Denormalization

**Old Schema:** Role in `company_members.role` junction table

**New Schema:** Role in `users.role` column

**Impact:**
- Simpler queries (no JOIN needed)
- Faster role checks
- Role changes require UPDATE on users table

#### 4. Company Email Must Match Admin Email

**Validation:** `src/modules/auth/utils/validation/registrationSchema.ts` (Lines 231-240)

```typescript
if (companyEmail !== adminEmail) {
  addIssue(ctx, "companyEmail", "Company email must match your admin email");
}
```

**Database Validation:** Edge function validates before calling `create_account_with_admin()`

**Impact:**
- Company email acts as primary admin contact
- Keeps ownership checks consistent across services
- Prevents mismatch between organization and admin

### Security Considerations

#### 1. Atomic Account Creation

**Database Function:** `create_account_with_admin()` runs in single transaction

**Benefits:**
- No partial account creation
- Rollback on any error
- Guaranteed consistency

#### 2. RLS Enforcement from First Query

**JWT Claims:** `account_uuid` and `user_role` added to token

**Performance:** Eliminates subquery overhead in RLS policies

**Security:** Cryptographically signed claims prevent tampering

#### 3. Soft Delete Pattern

**Implementation:** `deleted_at` timestamp on all tables

**Benefits:**
- Data recovery possible
- Audit trail preserved
- No accidental hard deletes

**Impact:**
- All queries filter `WHERE deleted_at IS NULL`
- Database size larger (deleted records retained)
- Requires periodic cleanup jobs

### Performance Optimizations

#### 1. JWT Claims for RLS

**Performance Gain:** 60-80% faster queries

| Metric | Without Claims | With Claims | Improvement |
|--------|----------------|-------------|-------------|
| Account queries | ~180ms | ~40ms | 78% faster |
| User list queries | ~220ms | ~65ms | 70% faster |
| Login flow (complete) | ~1800ms | ~950ms | 47% faster |

#### 2. SECURITY DEFINER Helper Function

**Purpose:** Break RLS recursion without query overhead

**Performance:** STABLE function result cached within transaction

#### 3. Subscription Status Caching

**Cache TTL:** 5 minutes via react-query

**Cache Hit Rate:** 80%+

**Impact:** 95% reduction in subscription queries

### Error Correlation and Debugging

**Correlation ID:** Present in all logs and responses

```typescript
const correlationId = 
  req.headers.get("x-correlation-id") || 
  payload.correlationId || 
  crypto.randomUUID();
```

**Logging:** All operations logged with correlation ID

```typescript
logger.info("Registration sign-up submitted", {
  attempt_id: attemptId,
  admin_uuid: data.user?.id,
  correlation_id: attemptId,
});
```

**Tracing:** Correlation ID passed through entire flow:
1. Frontend generates UUID
2. Sent to Edge Function via header
3. Returned in response
4. Logged in backend
5. Available for debugging

**Support:** Users can reference attempt ID when contacting support

---

## Code References

### Key Files

**Frontend:**

| File | Lines | Purpose |
|------|-------|---------|
| `src/modules/auth/components/RegistrationForm.tsx` | 446 | Main registration form view |
| `src/modules/auth/hooks/controllers/useRegistrationForm.ts` | 707 | Form state and validation logic |
| `src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` | 1000 | Registration submission state machine |
| `src/modules/auth/utils/validation/registrationSchema.ts` | 277 | Zod validation schema |
| `src/app/providers/auth/AuthProvider.tsx` | 660 | Auth context and user enrichment |

**Backend:**

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/functions/register-organization/index.ts` | 347 | Edge Function for registration |
| `src/core/supabase/queries/users.ts` | 328 | User CRUD operations |
| `src/core/supabase/queries/accounts.ts` | 227 | Account CRUD operations |
| `supabase/migrations/20250130000004_final_rls_fix_with_security_definer.sql` | 206 | RLS policies |

**Documentation:**

| File | Purpose |
|------|---------|
| `docs/migration/AUTH_B2B_SCHEMA_MIGRATION.md` | B2B migration guide |
| `docs/supabase_account_schemas/account-schemas.md` | Complete schema documentation |

---

## Sequence Diagram

```
User                RegistrationForm    useRegistrationForm    useRegistrationSubmission    Supabase Auth    Edge Function    Database
  │                       │                     │                         │                      │                 │
  │  Opens /register     │                     │                         │                      │                 │
  ├──────────────────────>│                     │                         │                      │                 │
  │                       │  Initialize State   │                         │                      │                 │
  │                       ├────────────────────>│                         │                      │                 │
  │                       │                     │                         │                      │                 │
  │  Fills Company Info  │                     │                         │                      │                 │
  ├──────────────────────>│  handleFieldChange  │                         │                      │                 │
  │                       ├────────────────────>│  evaluateErrors()       │                      │                 │
  │                       │                     ├─────────────────────────>                      │                 │
  │                       │                     │  Real-time validation   │                      │                 │
  │                       │                     │<─────────────────────────                      │                 │
  │                       │                     │                         │                      │                 │
  │  Clicks Continue     │                     │                         │                      │                 │
  ├──────────────────────>│  handleNextStep()   │                         │                      │                 │
  │                       ├────────────────────>│  attemptAdvance()       │                      │                 │
  │                       │                     │  ✓ Step valid           │                      │                 │
  │                       │                     ├─────► Next Step         │                      │                 │
  │                       │                     │                         │                      │                 │
  │  Fills Admin Creds   │                     │                         │                      │                 │
  ├──────────────────────>│  handleFieldChange  │                         │                      │                 │
  │                       ├────────────────────>│  Email Status Probe     │                      │                 │
  │                       │                     │  (debounced 500ms)      │                      │                 │
  │                       │                     ├──────────────────────────────────────────────────────────────────> Query users
  │                       │                     │                         │                      │                 │   WHERE email=?
  │                       │                     │<─────────────────────────────────────────────────────────────────  Availability result
  │                       │                     │                         │                      │                 │
  │  Submits Form        │                     │                         │                      │                 │
  ├──────────────────────>│  handleSubmit()     │                         │                      │                 │
  │                       ├────────────────────>│  buildPayload()         │                      │                 │
  │                       │                     ├────────────────────────>│                      │                 │
  │                       │                     │                         │  submit(payload)     │                 │
  │                       │                     │                         ├─────────────────────>│                 │
  │                       │                     │                         │  auth.signUp()       │                 │
  │                       │                     │                         │                      ├────────────────> Create auth.users + session
  │                       │                     │                         │<─────────────────────│                 │
  │                       │                     │                         │  Session issued      │                 │
  │                       │                     │                         │  Phase: persisting   │                 │
  │                       │                     │                         ├───────────────────────────────────────> Invoke register-organization
  │                       │                     │                         │                      │                 │
  │                       │                     │                         │                      │                 ├──────────────> create_account_with_admin()
  │                       │                     │                         │                      │                 │              │
  │                       │                     │                         │                      │<────────────────┤              │  Account + user created
  │                       │                     │                         │<─────────────────────│                 │
  │                       │                     │  dispatch({ success })  │                      │                 │
  │                       │<────────────────────┴─────────────────────────┴──────────────────────┘                 │
  │  Show Success        │                     │                         │                      │                 │
  │<──────────────────────│                     │                         │                      │                 │
  │  Go to Login         │                     │                         │                      │                 │
  └──────────────────────>│                     │                         │                      │                 │
```

---

**End of Documentation**
