# Auth B2B Schema Migration - Deployment Checklist

**Project:** auth-b2b-schema-migration
**Version:** 1.0.0
**Last Updated:** 2025-10-30
**Deployment Type:** Production Deployment
**Estimated Deployment Time:** 2-3 hours

---

## Table of Contents

1. [Pre-Deployment Verification](#pre-deployment-verification)
2. [Deployment Sequence](#deployment-sequence)
3. [Post-Deployment Validation](#post-deployment-validation)
4. [Monitoring Setup](#monitoring-setup)
5. [Rollback Criteria](#rollback-criteria)

---

## Pre-Deployment Verification

### Schema Validation

- [ ] **Schema Deployed Successfully**
  - [ ] `accounts` table exists with all columns
  - [ ] `users` table exists with all columns
  - [ ] `subscriptions` table exists with all columns
  - [ ] Email uniqueness constraint on `users.user_email`
  - [ ] Foreign keys configured: `users.account_uuid → accounts.account_uuid`

**Validation Command:**
```sql
-- Run in Supabase SQL Editor
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('accounts', 'users', 'subscriptions')
ORDER BY table_name, ordinal_position;
```

**Expected Tables:**
- ✅ `accounts` (6 columns: account_uuid, company_name, company_email, created_at, modified_at, deleted_at)
- ✅ `users` (10 columns: user_uuid, account_uuid, user_email, first_name, last_name, avatar_url, role, created_at, modified_at, deleted_at)
- ✅ `subscriptions` (10 columns: subscription_uuid, account_uuid, status, plan_id, trial_ends_at, current_period_start, current_period_end, created_at, modified_at, deleted_at)

### Database Function Validation

- [ ] **create_account_with_admin() Exists**
  ```sql
  -- Verify function exists
  SELECT proname, prosrc FROM pg_proc
  WHERE proname = 'create_account_with_admin';
  ```

- [ ] **Test Function Execution**
  ```sql
  -- Test with dummy data (will be rolled back)
  BEGIN;
  SELECT * FROM create_account_with_admin(
    'Test Company',
    'test@example.com',
    'Test',
    'User'
  );
  ROLLBACK;
  ```

**Expected Result:** Returns JSON with `account_uuid`, `user_uuid`, `subscription_uuid`

- [ ] **custom_access_token_hook Exists**
  ```sql
  -- Verify hook function exists
  SELECT proname, prosrc FROM pg_proc
  WHERE proname = 'custom_access_token_hook';
  ```

**Expected:** Function exists with `SECURITY DEFINER` attribute

### RLS Policies Validation

- [ ] **RLS Enabled on All Tables**
  ```sql
  -- Check RLS status
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('accounts', 'users', 'subscriptions');
  ```

**Expected:** All tables show `rowsecurity = true`

- [ ] **Correct Policies Exist**
  ```sql
  -- List all policies
  SELECT tablename, policyname, cmd
  FROM pg_policies
  WHERE tablename IN ('accounts', 'users', 'subscriptions')
  ORDER BY tablename, policyname;
  ```

**Expected Policies:**
- `accounts`: SELECT, UPDATE, DELETE policies filtering by account_uuid
- `users`: SELECT, INSERT, UPDATE, DELETE policies filtering by account_uuid
- `subscriptions`: SELECT, UPDATE policies filtering by account_uuid

- [ ] **Test RLS Isolation**
  ```sql
  -- Create two test accounts
  BEGIN;
  -- Insert test data and verify isolation
  -- (Detailed test in RLS_POLICY_ALIGNMENT.md)
  ROLLBACK;
  ```

**Expected:** Zero cross-account data access

### Indexes Validation

- [ ] **Required Indexes Exist**
  ```sql
  -- Check indexes
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE tablename IN ('accounts', 'users', 'subscriptions')
  ORDER BY tablename, indexname;
  ```

**Required Indexes:**
- ✅ `users(user_uuid)` - Primary key index
- ✅ `users(account_uuid)` - Foreign key index for RLS performance
- ✅ `users(user_email)` - Unique constraint index for email lookup
- ✅ `accounts(account_uuid)` - Primary key index
- ✅ `subscriptions(account_uuid)` - Foreign key index

### Triggers Validation

- [ ] **Email Sync Trigger Exists**
  ```sql
  -- Verify sync_user_email trigger
  SELECT trigger_name, event_manipulation, event_object_table
  FROM information_schema.triggers
  WHERE trigger_name = 'sync_user_email';
  ```

**Expected:** Trigger exists on `auth.users` table, fires on INSERT and UPDATE

### Frontend Code Validation

- [ ] **TypeScript Compilation Success**
  ```bash
  npm run type-check
  # OR
  npx tsc --noEmit
  ```

**Expected:** Zero TypeScript errors

- [ ] **Test Suite Passing**
  ```bash
  npm run test
  ```

**Expected:**
- 90%+ pass rate (270+/300 tests)
- 100% critical path coverage (AuthProvider, orphanDetection)
- Zero test failures in critical authentication modules

- [ ] **Build Success**
  ```bash
  npm run build
  ```

**Expected:** Production build completes without errors

### Edge Function Validation

- [ ] **register-organization Function Deployed**
  ```bash
  npx supabase functions list
  ```

**Expected:** `register-organization` appears in function list

- [ ] **Test Edge Function Locally**
  ```bash
  # Set environment variables
  export VITE_SUPABASE_URL="your-supabase-url"
  export VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY="your-anon-key"

  # Test function
  npx supabase functions serve register-organization
  ```

**Test Cases:**
- ✅ Valid payload returns 201 with account_uuid
- ✅ Duplicate email returns 409 Conflict
- ✅ Invalid payload returns 400 Bad Request

---

## Deployment Sequence

**IMPORTANT:** Follow this exact sequence to ensure smooth deployment with minimal user impact.

### Step 1: Deploy Edge Function Changes (T+0 minutes)

- [ ] **Deploy register-organization Edge Function**
  ```bash
  npx supabase functions deploy register-organization
  ```

- [ ] **Verify Deployment**
  ```bash
  # Check function version
  npx supabase functions list

  # Should show updated timestamp
  ```

- [ ] **Test Edge Function in Production**
  ```bash
  # Use curl or Postman to test
  curl -X POST https://your-project.supabase.co/functions/v1/register-organization \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"company_name":"Test","company_email":"test@example.com","first_name":"Test","last_name":"User","correlationId":"test-123"}'
  ```

**Expected:** Function responds without errors (may fail due to duplicate email, which is expected behavior)

**Rollback Trigger:** If Edge Function returns 500 errors on all requests

### Step 2: Deploy Frontend Changes (T+15 minutes)

**Wait 15 minutes after Edge Function deployment to monitor for issues**

- [ ] **Build Production Frontend**
  ```bash
  npm run build
  ```

- [ ] **Deploy to Hosting Provider**

  **For Vercel:**
  ```bash
  vercel --prod
  ```

  **For Netlify:**
  ```bash
  netlify deploy --prod
  ```

  **For Custom Hosting:**
  ```bash
  # Upload dist/ folder to hosting
  # Update DNS/CDN configuration
  ```

- [ ] **Verify Frontend Deployment**
  - [ ] Visit production URL
  - [ ] Check browser console for errors
  - [ ] Verify assets loaded correctly (no 404s)

**Rollback Trigger:** If frontend fails to load or shows critical errors

### Step 3: Configure custom_access_token_hook (T+30 minutes)

**Wait 15 minutes after frontend deployment to monitor for issues**

- [ ] **Navigate to Supabase Dashboard**
  - URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID`

- [ ] **Enable Custom Access Token Hook**
  - Go to **Authentication → Hooks**
  - Toggle **"Enable Custom Access Token Hook"** to **ON**
  - Enter URI: `pg-functions://postgres/public/custom_access_token_hook`
  - Click **"Save"**

- [ ] **Verify Hook Configuration**
  - [ ] Green checkmark next to "Custom Access Token Hook"
  - [ ] Status shows **"Enabled"**
  - [ ] URI field shows `pg-functions://postgres/public/custom_access_token_hook`

**Rollback Trigger:** If "infinite recursion" errors appear in logs

### Step 4: Force Session Refresh for Existing Users (T+45 minutes)

**Optional but recommended for immediate effect**

- [ ] **Send Email to Active Users**
  - Subject: "System Update - Please Refresh Your Session"
  - Body: "We've deployed a performance update. Please log out and log back in for the best experience."

- [ ] **OR Implement Automatic Session Refresh**
  ```typescript
  // Add to AuthProvider componentDidMount
  useEffect(() => {
    const refreshSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !session.user.app_metadata.account_uuid) {
        // Claims missing, force refresh
        await supabase.auth.refreshSession();
      }
    };
    refreshSession();
  }, []);
  ```

---

## Post-Deployment Validation

### Functional Testing (T+60 minutes)

Run these tests immediately after deployment completion:

#### Test 1: Registration Flow

- [ ] **Navigate to Registration Page**
  - URL: `https://your-app.com/register`

- [ ] **Complete Registration**
  - Enter company name
  - Enter company email
  - Enter admin first/last name
  - Submit form

**Expected Results:**
- ✅ Email verification sent
- ✅ After verification, redirected to login
- ✅ Login successful
- ✅ User dashboard loads
- ✅ Account UUID in user context
- ✅ Role = 'owner'

**Validation Query:**
```sql
-- Check account created
SELECT * FROM accounts WHERE company_email = 'test-email@example.com';

-- Check user created
SELECT * FROM users WHERE user_email = 'test-email@example.com';

-- Check subscription created
SELECT * FROM subscriptions WHERE account_uuid = (
  SELECT account_uuid FROM users WHERE user_email = 'test-email@example.com'
);
```

#### Test 2: Login Flow

- [ ] **Login with Existing User**
  - Navigate to login page
  - Enter credentials
  - Submit

**Expected Results:**
- ✅ Login successful
- ✅ Orphan detection passes (<200ms)
- ✅ Profile enriched with account_uuid and role
- ✅ Session established
- ✅ Redirected to workspace

**Monitor Logs For:**
- ⚠️ Orphan detection latency (should be <200ms p95)
- ⚠️ JWT claims present (no warning about missing custom_access_token_hook)
- ⚠️ Zero errors in browser console

#### Test 3: JWT Claims Verification

- [ ] **Inspect JWT Token**
  ```javascript
  // Run in browser console after login
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('JWT Claims:', payload);
  ```

**Expected:**
```json
{
  "sub": "user-uuid",
  "app_metadata": {
    "account_uuid": "account-uuid-here",
    "user_role": "owner"
  },
  ...
}
```

**If Claims Missing:**
- ⚠️ Check hook configuration in Dashboard
- ⚠️ Force session refresh: `await supabase.auth.refreshSession()`
- ⚠️ Verify hook function exists in database

#### Test 4: RLS Isolation

- [ ] **Create Two Test Accounts**
  - Register Account A with email1@test.com
  - Register Account B with email2@test.com

- [ ] **Test Cross-Account Access**
  - Login as Account A user
  - Attempt to query Account B data using known UUID

**Validation:**
```javascript
// Login as Account A user
const { data: accountBData } = await supabase
  .from('accounts')
  .select('*')
  .eq('account_uuid', 'known-account-b-uuid');

console.log('Account B Data:', accountBData);
// ✅ Expected: Empty array [] (RLS blocks access)
```

**Expected Results:**
- ✅ Zero rows returned for cross-account queries
- ✅ User can only see own account data
- ✅ RLS policy blocks unauthorized access

#### Test 5: Soft Delete Functionality

- [ ] **Soft Delete Test Account**
  ```sql
  -- Soft delete an account
  UPDATE accounts
  SET deleted_at = now()
  WHERE account_uuid = 'test-account-uuid';
  ```

- [ ] **Verify Account Invisible**
  ```javascript
  // Query should return null
  const { data } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_uuid', 'test-account-uuid')
    .maybeSingle();

  console.log('Deleted Account:', data);
  // ✅ Expected: null
  ```

- [ ] **Restore Account**
  ```sql
  -- Restore soft-deleted account
  UPDATE accounts
  SET deleted_at = NULL
  WHERE account_uuid = 'test-account-uuid';
  ```

**Expected:** Account becomes visible again in queries

#### Test 6: Role-Based Permissions

- [ ] **Test Owner Permissions**
  - Login as owner
  - Verify can access all management controls
  - Verify can delete account

- [ ] **Test Admin Permissions**
  - Update user role to 'admin'
  - Logout and login again
  - Verify can manage account
  - Verify CANNOT delete account

- [ ] **Test Member Permissions**
  - Update user role to 'member'
  - Logout and login again
  - Verify NO management controls visible
  - Verify read-only access

**RLS Enforcement Test:**
```javascript
// Login as member
const { error } = await supabase
  .from('accounts')
  .update({ company_name: 'Hacked' })
  .eq('account_uuid', 'user-account-uuid');

console.log('Error:', error);
// ✅ Expected: RLS policy violation (error code 42501)
```

---

## Monitoring Setup

### Performance Metrics (Immediate Monitoring)

**Dashboard Metrics to Track:**

1. **Orphan Detection Latency**
   - Metric: p95 and p99 latency
   - Target: p95 < 200ms, p99 < 500ms
   - Alert: p95 > 300ms

2. **Login Flow Duration**
   - Metric: End-to-end time from submit to dashboard
   - Target: p95 < 2000ms
   - Alert: p95 > 3000ms

3. **Subscription Cache Hit Rate**
   - Metric: % of subscription queries served from cache
   - Target: > 80%
   - Alert: < 60%

4. **JWT Claims Coverage**
   - Metric: % of logins with JWT claims present
   - Target: > 95%
   - Alert: < 80% (indicates hook misconfiguration)

### Error Rate Monitoring

**Alert Thresholds:**

1. **Authentication Failure Rate**
   - Normal: < 2%
   - Warning: 2-5%
   - Critical: > 5% (rollback trigger)

2. **Orphan Detection Failures**
   - Normal: < 1%
   - Warning: 1-3%
   - Critical: > 3%

3. **RLS Policy Violations**
   - Normal: 0
   - Warning: > 5 per hour
   - Critical: > 20 per hour (security incident)

4. **Edge Function Errors**
   - Normal: < 1%
   - Warning: 1-5%
   - Critical: > 5%

### Log Monitoring

**Search for These Patterns:**

```
# Missing JWT claims warning
grep "Custom access token hook not configured" logs/*.log

# Orphan detection failures
grep "OrphanDetectionError" logs/*.log

# RLS policy violations
grep "42501" logs/*.log

# Email uniqueness errors
grep "EMAIL_EXISTS" logs/*.log
```

**Set Up Alerts:**
- Email notification if any critical pattern appears > 10 times/hour
- Slack notification for RLS policy violations
- PagerDuty for authentication failure rate > 5%

---

## Rollback Criteria

**Initiate immediate rollback if any of these occur:**

### Critical Issues (Immediate Rollback)

- [ ] **Authentication Failure Rate > 5%**
  - More than 5% of login attempts failing
  - Check error logs for common error types

- [ ] **Cross-Account Data Leakage Detected**
  - RLS policy failure allowing unauthorized data access
  - SECURITY CRITICAL - rollback immediately

- [ ] **Orphan Detection Latency > 500ms p95**
  - Performance degradation indicating database issues
  - Users experiencing slow login times

- [ ] **Edge Function Total Failure**
  - All registration attempts returning 500 errors
  - New user sign-ups completely broken

### Warning Issues (Monitor, Rollback if Worsening)

- [ ] **JWT Claims Missing in > 20% of Sessions**
  - Indicates custom_access_token_hook misconfiguration
  - Performance degraded but functional
  - Fix: Verify hook configuration, force session refresh

- [ ] **Email Uniqueness Constraint Unexpected Violations**
  - Database constraint errors on valid new registrations
  - May indicate data inconsistency
  - Investigate before deciding on rollback

- [ ] **Subscription Cache Hit Rate < 60%**
  - Lower than expected cache performance
  - Not critical, investigate caching logic

### Rollback Procedure

**See:** [../migration/AUTH_B2B_SCHEMA_MIGRATION.md#rollback-procedures](../migration/AUTH_B2B_SCHEMA_MIGRATION.md#rollback-procedures)

**Quick Rollback Steps:**

1. **Revert Frontend**
   ```bash
   git revert <migration-commit>
   npm run build
   # Deploy previous version
   ```

2. **Revert Edge Function**
   ```bash
   git checkout <previous-commit> -- supabase/functions/register-organization
   npx supabase functions deploy register-organization
   ```

3. **Disable Custom Access Token Hook**
   - Supabase Dashboard → Authentication → Hooks
   - Toggle OFF

4. **Verify Rollback Success**
   ```bash
   npm run test:e2e -- registration.test.ts
   npm run test:e2e -- login.test.ts
   ```

---

## Success Criteria

**Deployment is successful when:**

- ✅ All pre-deployment validations passed
- ✅ Deployment sequence completed without errors
- ✅ All 6 functional tests passed
- ✅ Performance metrics within targets
- ✅ Error rates below warning thresholds
- ✅ No rollback criteria triggered
- ✅ JWT claims present in > 95% of sessions
- ✅ RLS isolation verified (zero cross-account access)

**Sign-Off Required From:**
- [ ] Tech Lead - Code review and architecture approval
- [ ] QA Lead - Test execution and validation
- [ ] DevOps - Monitoring and alerting configured
- [ ] Security - RLS policies and penetration tests reviewed

---

## Post-Deployment Tasks

### Immediate (Within 24 Hours)

- [ ] Monitor dashboards for first 4 hours continuously
- [ ] Check error logs every hour
- [ ] Verify JWT claims coverage reaches > 95%
- [ ] Test registration and login flows manually
- [ ] Collect user feedback from early adopters

### Short-Term (Within 1 Week)

- [ ] Review performance metrics and optimize if needed
- [ ] Archive legacy query helpers from codebase
- [ ] Update documentation with any production findings
- [ ] Conduct post-mortem meeting with team
- [ ] Plan removal of legacy code (2 weeks retention period)

### Long-Term (Within 1 Month)

- [ ] Analyze authentication metrics trends
- [ ] Identify areas for further optimization
- [ ] Plan for enhanced features (multi-account support, etc.)
- [ ] Document lessons learned
- [ ] Update deployment runbook with production insights

---

## Emergency Contacts

**On-Call Rotation:**
- Primary: [Name] - [Phone] - [Email]
- Secondary: [Name] - [Phone] - [Email]
- Escalation: [Tech Lead] - [Phone] - [Email]

**Vendor Support:**
- Supabase Support: support@supabase.com (Pro plan priority support)
- Hosting Provider: [Your provider support contact]

**Communication Channels:**
- **Slack:** #auth-migration-alerts
- **Status Page:** https://status.your-app.com
- **Internal Updates:** #engineering

---

## Appendix: Validation Scripts

### Schema Validation Script

```sql
-- Save as validate_schema.sql
-- Run in Supabase SQL Editor

-- Check tables exist
SELECT 'Tables Check' as test_name,
  CASE
    WHEN COUNT(*) = 3 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('accounts', 'users', 'subscriptions');

-- Check required indexes
SELECT 'Indexes Check' as test_name,
  CASE
    WHEN COUNT(*) >= 5 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_indexes
WHERE tablename IN ('accounts', 'users', 'subscriptions');

-- Check RLS enabled
SELECT 'RLS Check' as test_name,
  CASE
    WHEN COUNT(*) = 3 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('accounts', 'users', 'subscriptions')
  AND rowsecurity = true;

-- Check functions exist
SELECT 'Functions Check' as test_name,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_proc
WHERE proname IN ('create_account_with_admin', 'custom_access_token_hook');
```

**Expected Output:**
```
test_name          | result
-------------------+-------
Tables Check       | PASS
Indexes Check      | PASS
RLS Check          | PASS
Functions Check    | PASS
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-30
**Next Review:** After production deployment
