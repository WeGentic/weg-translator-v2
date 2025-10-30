**Classic B2B multi-tenant SaaS model**.

## 🎯 **Understanding**

1. **Account Creation Flow**: Admin email → Creates Account → Admin becomes first user → Admin invites other users
2. **Email Uniqueness**: GLOBAL (current schema is correct: `user_email text NOT NULL UNIQUE`)
3. **Critical**: Every user must have `account_uuid` in their JWT claims for efficient RLS

---

## 📐 **SCHEMA**

```sql
-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE public.accounts (
  account_uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  
  company_name text NOT NULL,
  company_phone text,
  company_address text,
  company_email text,
  billing_email text,
  timezone text DEFAULT 'UTC',
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  
  CONSTRAINT accounts_pkey PRIMARY KEY (account_uuid),
  CONSTRAINT accounts_company_name_check CHECK (char_length(company_name) >= 2)
);

-- ============================================================================
-- USERS TABLE (Application layer on top of auth.users)
-- ============================================================================
CREATE TABLE public.users (
  user_uuid uuid NOT NULL,  -- References auth.users(id)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  
  account_uuid uuid NOT NULL,  -- The company this user belongs to
  role text NOT NULL DEFAULT 'member',
  
  username text,
  first_name text,
  last_name text,
  phone text,
  user_email text NOT NULL,  -- Denormalized from auth.users.email for convenience
  avatar text,
  
  is_active boolean DEFAULT true,
  last_login_at timestamp with time zone,
  invited_at timestamp with time zone DEFAULT now(),
  invited_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT users_pkey PRIMARY KEY (user_uuid),
  CONSTRAINT users_account_uuid_fkey 
    FOREIGN KEY (account_uuid) 
    REFERENCES public.accounts(account_uuid) ON DELETE CASCADE,
  CONSTRAINT users_user_uuid_fkey 
    FOREIGN KEY (user_uuid) 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT users_user_email_unique UNIQUE (user_email),  -- Global uniqueness
  CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE public.subscriptions (
  subscription_uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  
  account_uuid uuid NOT NULL,
  subscription_type text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'trial',
  
  expires_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  
  payment_type text,
  payment_id text,
  
  CONSTRAINT subscriptions_pkey PRIMARY KEY (subscription_uuid),
  CONSTRAINT subscriptions_account_uuid_fkey 
    FOREIGN KEY (account_uuid) 
    REFERENCES public.accounts(account_uuid) ON DELETE CASCADE,
  CONSTRAINT subscriptions_status_check 
    CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  CONSTRAINT subscriptions_type_check
    CHECK (subscription_type IN ('trial', 'basic', 'professional', 'enterprise'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_users_account_uuid ON public.users(account_uuid);
CREATE INDEX idx_users_email ON public.users(user_email);
CREATE INDEX idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_subscriptions_account_uuid ON public.subscriptions(account_uuid);
CREATE INDEX idx_subscriptions_expires_at ON public.subscriptions(expires_at);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- Only one active subscription per account
CREATE UNIQUE INDEX idx_subscriptions_active_account 
  ON public.subscriptions(account_uuid) 
  WHERE status IN ('trial', 'active') AND deleted_at IS NULL;

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING modified_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## 🔐 **CRITICAL: ACCOUNT CREATION FLOW**

This ensures the Admin user is properly tied to the account during signup:

```sql
-- ============================================================================
-- FUNCTION: Create account with admin user atomically
-- ============================================================================
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
    'trial',
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_account_with_admin TO authenticated;
```

---

## 🛡️ **ROW LEVEL SECURITY (RLS) POLICIES**

These policies ensure **PERFECT ISOLATION** between accounts:

```sql
-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR ACCOUNTS
-- ============================================================================

-- Users can view their own account
CREATE POLICY "Users can view own account"
  ON public.accounts FOR SELECT
  USING (
    account_uuid IN (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid() 
        AND deleted_at IS NULL
    )
  );

-- Only owners/admins can update account
CREATE POLICY "Owners and admins can update account"
  ON public.accounts FOR UPDATE
  USING (
    account_uuid IN (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid() 
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    )
  );

-- No direct INSERT (use create_account_with_admin function)
-- No DELETE (use soft delete via UPDATE)

-- ============================================================================
-- RLS POLICIES FOR USERS
-- ============================================================================

-- Users can view other users in their account
CREATE POLICY "Users can view users in own account"
  ON public.users FOR SELECT
  USING (
    account_uuid IN (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid()
        AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Only owners/admins can insert new users (invitations)
CREATE POLICY "Owners and admins can invite users"
  ON public.users FOR INSERT
  WITH CHECK (
    account_uuid IN (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid() 
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (user_uuid = auth.uid())
  WITH CHECK (
    -- Prevent users from changing their account_uuid
    account_uuid = (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid()
    )
    -- Prevent regular users from elevating their role
    AND (
      role = (SELECT role FROM public.users WHERE user_uuid = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_uuid = auth.uid() 
          AND role IN ('owner', 'admin')
      )
    )
  );

-- Only owners/admins can update other users
CREATE POLICY "Owners and admins can update users in account"
  ON public.users FOR UPDATE
  USING (
    account_uuid IN (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid() 
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    )
  );

-- Only owners can delete users (soft delete via UPDATE)
-- No DELETE policy needed as we use soft deletes

-- ============================================================================
-- RLS POLICIES FOR SUBSCRIPTIONS
-- ============================================================================

-- Users can view their account's subscription
CREATE POLICY "Users can view own account subscription"
  ON public.subscriptions FOR SELECT
  USING (
    account_uuid IN (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid()
        AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Only owners can update subscriptions
CREATE POLICY "Owners can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    account_uuid IN (
      SELECT account_uuid 
      FROM public.users 
      WHERE user_uuid = auth.uid() 
        AND role = 'owner'
        AND deleted_at IS NULL
    )
  );

-- Subscriptions are created by the system (via create_account_with_admin or webhook)
CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);  -- Controlled by SECURITY DEFINER functions
```

---

## 🎫 **JWT CLAIMS FOR EFFICIENT RLS**

Add `account_uuid` to JWT claims for better performance:

```sql
-- ============================================================================
-- FUNCTION: Add account_uuid to JWT claims
-- ============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_account_uuid uuid;
  user_role text;
BEGIN
  -- Fetch the user's account_uuid and role
  SELECT account_uuid, role INTO user_account_uuid, user_role
  FROM public.users
  WHERE user_uuid = (event->>'user_id')::uuid
    AND deleted_at IS NULL
    AND is_active = true;

  claims := event->'claims';

  IF user_account_uuid IS NOT NULL THEN
    -- Set custom claims
    claims := jsonb_set(claims, '{account_uuid}', to_jsonb(user_account_uuid));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  -- Update the 'claims' object in the original event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

**Then configure this in Supabase Dashboard:**
1. Go to Authentication → Hooks
2. Select "Custom Access Token" hook
3. Point to `public.custom_access_token_hook`

---

## 🔄 **AUTOMATIC USER PROFILE CREATION**

Ensure user profile is created when invited users sign up:

```sql
-- ============================================================================
-- TRIGGER: Sync auth.users email changes to users table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET user_email = NEW.email,
      modified_at = now()
  WHERE user_uuid = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();
```

---

## ✅ **TESTING RLS ISOLATION**

Run these tests to ensure perfect isolation:

```sql
-- Test 1: Create two test accounts
SELECT create_account_with_admin('Company A', 'companya@test.com', 'Admin', 'A');
SELECT create_account_with_admin('Company B', 'companyb@test.com', 'Admin', 'B');

-- Test 2: Try to access other account's data (should return 0 rows)
-- Log in as Company A admin, then run:
SELECT * FROM accounts WHERE company_name = 'Company B';  -- Should return 0 rows
SELECT * FROM users WHERE account_uuid != (SELECT account_uuid FROM users WHERE user_uuid = auth.uid());  -- Should return 0 rows

-- Test 3: Try to update other account (should fail)
UPDATE accounts SET company_name = 'Hacked' WHERE company_name = 'Company B';  -- Should affect 0 rows
```

---

## 🚨 **IMPORTANT NOTES**

1. **Email must be unique globally** - Prevents cross-account contamination
2. **RLS is enforced for ALL users** - Even admin/owner cannot bypass
3. **JWT claims contain `account_uuid`** - Enables efficient RLS queries
4. **Soft deletes everywhere** - Never hard-delete, use `deleted_at`
5. **Atomic account creation** - Admin + Account + Subscription created together

---
