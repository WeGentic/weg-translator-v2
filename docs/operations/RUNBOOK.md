# Auth B2B Schema Migration - Operational Runbook

**Project:** auth-b2b-schema-migration
**Version:** 1.0.0
**Last Updated:** 2025-10-30
**Purpose:** Troubleshooting guide for common operational issues

---

## Table of Contents

1. [Common Issues](#common-issues)
2. [Troubleshooting Procedures](#troubleshooting-procedures)
3. [Escalation Procedures](#escalation-procedures)
4. [Recovery Procedures](#recovery-procedures)
5. [Performance Tuning](#performance-tuning)

---

## Common Issues

### Issue 1: JWT Claims Missing

**Symptoms:**
- Warning in logs: `Custom access token hook not configured. Performance degraded.`
- Slow query performance (150ms+ vs expected 40ms)
- Users experiencing delayed login

**Root Cause:**
Custom access token hook not configured in Supabase Dashboard, causing fallback to database queries for `account_uuid` and `user_role`.

**Impact:**
- **Severity:** Medium (Functional but degraded performance)
- **User Impact:** Slower login experience (additional 50-100ms latency)
- **Business Impact:** Increased database load, higher infrastructure costs

**Resolution Steps:**

1. **Verify Hook Configuration**
   - Navigate to Supabase Dashboard: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID`
   - Go to **Authentication → Hooks**
   - Check if **"Custom Access Token Hook"** is enabled

2. **Configure the Hook**
   - Toggle **"Enable Custom Access Token Hook"** to **ON**
   - Enter URI: `pg-functions://postgres/public/custom_access_token_hook`
   - Click **"Save"**

3. **Verify Hook Function Exists**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT proname, prosrc
   FROM pg_proc
   WHERE proname = 'custom_access_token_hook';
   ```

   **Expected:** Function exists with `SECURITY DEFINER` attribute

   **If Missing:**
   ```bash
   # Deploy migration
   npx supabase db push

   # Or manually run:
   # supabase/migrations/20250129172156_add_custom_access_token_hook.sql
   ```

4. **Force User Session Refresh**
   - Existing users need to refresh their session to get updated JWT with claims
   - Options:
     - **Option A:** Ask users to logout and login again
     - **Option B:** Implement automatic session refresh:
       ```typescript
       // In AuthProvider
       const refreshSessionIfNeeded = async () => {
         const { data: { session } } = await supabase.auth.getSession();
         if (session && !session.user.app_metadata.account_uuid) {
           await supabase.auth.refreshSession();
         }
       };
       ```

5. **Verify Claims Present**
   ```javascript
   // In browser console
   const session = await supabase.auth.getSession();
   const token = session.data.session?.access_token;
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('JWT Claims:', payload.app_metadata);
   // Should show: { account_uuid: '...', user_role: 'owner' }
   ```

**Prevention:**
- Add pre-deployment validation check for hook configuration
- Include hook setup in deployment checklist
- Monitor JWT claims coverage metric (target: > 95%)

**Related Documentation:**
- [Custom Access Token Hook Configuration](../migration/AUTH_B2B_SCHEMA_MIGRATION.md#custom-access-token-hook-configuration)

---

### Issue 2: Email Uniqueness Errors

**Symptoms:**
- User receives error: `This email is already registered. Please login or use a different email.`
- HTTP 409 Conflict response from registration endpoint
- Error code: `EMAIL_EXISTS`

**Root Cause:**
User attempting to register with email that already exists in the system. The new schema enforces **global email uniqueness** across all accounts.

**Impact:**
- **Severity:** Low (Expected behavior, not a bug)
- **User Impact:** Cannot complete registration with desired email
- **Business Impact:** Potential conversion loss if user doesn't use alternative

**Resolution Steps:**

1. **Guide User to Login**
   - If user has existing account with this email, direct them to login page
   - Suggest password reset if they forgot password

2. **Verify Email Not in Database**
   ```sql
   -- Check if email exists
   SELECT user_uuid, account_uuid, user_email, role, deleted_at
   FROM users
   WHERE user_email = 'user@example.com';
   ```

   **If Email Found (deleted_at IS NULL):**
   - User has active account → Guide to login
   - Suggest password reset if needed

   **If Email Found (deleted_at IS NOT NULL):**
   - User previously soft-deleted → Potential account recovery scenario
   - See [Issue 5: Soft-Deleted Account Recovery](#issue-5-soft-deleted-account-recovery)

3. **Suggest Email Aliases**
   - Users can use email aliases for different accounts:
     - `user+company1@gmail.com`
     - `user+company2@gmail.com`
   - Gmail, Outlook, and most email providers support this

4. **Manual Account Merge (If Needed)**
   - If legitimate business case for same user in multiple accounts
   - **WARNING:** Current schema does not support multi-account users
   - Escalate to engineering for schema modification discussion

**Prevention:**
- Real-time email validation during registration (500ms debounce)
- Clear messaging about global email uniqueness
- Provide login link in error message
- Consider implementing account switching feature (future enhancement)

**User Communication Template:**
```
Subject: Email Already Registered

Hi [User],

The email address [email] is already registered in our system.

If you already have an account:
- Click here to login: [Login Link]
- Forgot your password? Click here: [Password Reset Link]

If this is your first time:
- You may have signed up previously. Try logging in.
- You can use an email alias like user+company@example.com

Need help? Contact support: support@yourapp.com
```

**Related Documentation:**
- [Breaking Changes - Global Email Uniqueness](../migration/AUTH_B2B_SCHEMA_MIGRATION.md#breaking-changes)

---

### Issue 3: Orphan Detection Failures

**Symptoms:**
- Users unable to login
- Error message: `Unable to verify account status. Please try again later.`
- Error in logs: `OrphanDetectionError` with correlation ID
- All 3 retry attempts exhausted

**Root Cause:**
Orphan detection query to `users` table failing due to database connectivity issues, timeout, or RLS policy problems.

**Impact:**
- **Severity:** High (Blocks user authentication - fail-closed security)
- **User Impact:** Cannot login, blocked from application
- **Business Impact:** User frustration, support tickets, potential churn

**Resolution Steps:**

1. **Check Database Connectivity**
   ```bash
   # Test Supabase database connection
   npx supabase db ping

   # Or use psql
   psql "postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -c "SELECT 1"
   ```

   **If Connection Fails:**
   - Check Supabase status page: https://status.supabase.com
   - Verify network connectivity from application server
   - Check firewall rules (if self-hosted)

2. **Check Query Performance**
   ```sql
   -- Test orphan detection query
   EXPLAIN ANALYZE
   SELECT user_uuid, account_uuid, role, deleted_at
   FROM users
   WHERE user_uuid = 'test-user-uuid';
   ```

   **Expected:** Query execution < 50ms

   **If Slow (> 200ms):**
   - Verify index exists on `users(user_uuid)`
   - Check database load (high CPU/memory)
   - Consider scaling database resources

3. **Verify Index Exists**
   ```sql
   -- Check for user_uuid index
   SELECT tablename, indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'users'
     AND indexname LIKE '%user_uuid%';
   ```

   **If Missing:**
   ```sql
   -- Create index
   CREATE INDEX IF NOT EXISTS idx_users_user_uuid
   ON users(user_uuid);
   ```

4. **Check RLS Policies**
   ```sql
   -- Verify RLS policies allow self-query
   SELECT policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'users';
   ```

   **Expected Policies:**
   - `Users can view own user record` - Allows users to query their own record
   - `Users can view same account users` - Allows users to see teammates

   **Test RLS Policy:**
   ```sql
   -- Set role to authenticated user
   SET ROLE authenticated;
   SET request.jwt.claim.sub = 'test-user-uuid';

   -- Should return user's own record
   SELECT * FROM users WHERE user_uuid = 'test-user-uuid';
   ```

5. **Check Timeout Configuration**
   - Orphan detection has 200ms timeout per attempt
   - 3 attempts with exponential backoff: 0ms, 100ms jitter, 300ms jitter
   - Total max time: ~600ms before fail-closed

   **Adjust Timeout (If Needed):**
   ```typescript
   // In orphanDetection.ts
   const checkIfOrphaned = async (userId: string) => {
     // Current timeout: 200ms
     // If database is consistently slow, consider increasing to 300ms
     // WARNING: Higher timeout delays fail-closed blocking
   };
   ```

6. **Review Error Logs**
   ```bash
   # Search for correlation ID
   grep "[CORRELATION-ID]" logs/*.log

   # Look for patterns:
   # - "timeout" → Database slow or network issues
   # - "permission denied" → RLS policy problem
   # - "connection refused" → Database connectivity issue
   ```

7. **Temporary Workaround (Emergency Only)**
   - If widespread issue affecting all users
   - Temporarily disable orphan detection (NOT RECOMMENDED - security risk)
   - **ONLY for emergency database maintenance**

   ```typescript
   // EMERGENCY ONLY - DO NOT COMMIT
   const checkIfOrphaned = async (userId: string) => {
     // Skip orphan detection temporarily
     return {
       orphaned: false,
       hasValidAccount: true,
       accountUuid: null, // Will fall back to query
       role: null
     };
   };
   ```

   **Rollback immediately after database issue resolved**

**Prevention:**
- Monitor orphan detection latency p95 < 200ms
- Set up alerts for p95 > 300ms
- Implement database connection pooling
- Regular database performance reviews
- Maintain database resource headroom (CPU < 70%)

**Escalation Criteria:**
- > 10% of login attempts failing with OrphanDetectionError
- p95 latency > 500ms consistently
- Database connectivity issues persist > 15 minutes

**Related Documentation:**
- [Orphan Detection Implementation](../migration/AUTH_B2B_SCHEMA_MIGRATION.md#phase-3-orphan-detection-rewrite-task-3)

---

### Issue 4: Subscription Status Errors

**Symptoms:**
- User sees incorrect trial status (expired when should be active)
- Subscription status not updating after upgrade
- Error: `Unable to verify subscription status`
- Trial expiry banner showing incorrect days remaining

**Root Cause:**
- Subscription status cached with stale data (5-minute TTL)
- Cache not invalidated after subscription update
- Database query failing to fetch subscription

**Impact:**
- **Severity:** Medium (Functional but confusing UX)
- **User Impact:** Incorrect trial status, potential false "upgrade" prompts
- **Business Impact:** User confusion, support tickets

**Resolution Steps:**

1. **Verify Subscription in Database**
   ```sql
   -- Check subscription status
   SELECT subscription_uuid, account_uuid, status, trial_ends_at, deleted_at
   FROM subscriptions
   WHERE account_uuid = 'account-uuid-here'
     AND deleted_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   **Expected:**
   - Status = 'trialing' for new accounts
   - `trial_ends_at` = `created_at + 14 days`
   - `deleted_at` IS NULL

2. **Invalidate Subscription Cache**

   **Option A: Manual Cache Invalidation (Browser Console)**
   ```javascript
   // Run in browser console
   import { queryClient } from '@/lib/react-query';

   // Get user's account UUID
   const { accountUuid } = useAuth();

   // Invalidate subscription cache
   queryClient.invalidateQueries(['subscription', accountUuid]);

   // Refresh subscription status
   await queryClient.refetchQueries(['subscription', accountUuid]);
   ```

   **Option B: Programmatic Invalidation**
   ```typescript
   // In subscription update handler
   const handleSubscriptionUpgrade = async () => {
     await upgradeSubscription(); // API call

     // Invalidate cache immediately
     queryClient.invalidateQueries(['subscription', accountUuid]);
   };
   ```

3. **Check Cache Hit Rate**
   ```sql
   -- Monitor cache performance
   -- (Requires custom logging implementation)
   -- Target: > 80% cache hit rate
   ```

   **If Cache Hit Rate < 60%:**
   - Investigate cache TTL (should be 5 minutes)
   - Check if cache invalidation triggering too frequently
   - Review subscription update frequency

4. **Verify Trial Expiry Calculation**
   ```javascript
   // Test trial expiry calculation
   const subscription = {
     status: 'trialing',
     trial_ends_at: '2025-11-15T00:00:00Z'
   };

   const now = new Date();
   const trialEnd = new Date(subscription.trial_ends_at);
   const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

   console.log('Days Remaining:', daysRemaining);
   // Should match UI display
   ```

5. **Manual Subscription Status Update**
   ```sql
   -- If subscription incorrectly marked as expired
   UPDATE subscriptions
   SET status = 'trialing',
       trial_ends_at = NOW() + INTERVAL '14 days'
   WHERE account_uuid = 'account-uuid-here';
   ```

6. **Force Subscription Re-fetch**
   - Ask user to logout and login again
   - Cache will refresh on next login
   - Verify updated status displays correctly

**Prevention:**
- Implement subscription update webhooks to invalidate cache
- Add cache refresh on subscription management page load
- Monitor cache hit rate (target: > 80%)
- Set up alerts for cache hit rate < 60%

**User Communication:**
If user reports incorrect subscription status:
```
Hi [User],

We've identified a caching issue with your subscription status display.

To resolve:
1. Log out of the application
2. Log back in
3. Your correct subscription status will display

If the issue persists, please reply with:
- Your account email
- Screenshot of the incorrect status

We're working on a permanent fix.

Thanks for your patience!
```

**Related Documentation:**
- [Subscription Status Integration](../migration/AUTH_B2B_SCHEMA_MIGRATION.md#phase-7-subscription-status-integration-task-7)

---

### Issue 5: Soft-Deleted Account Recovery

**Symptoms:**
- User cannot login with error: `Your account has been deactivated. Please contact support.`
- Registration with same email fails with `EMAIL_EXISTS` error
- User claims they never deleted their account

**Root Cause:**
- Account or user record has `deleted_at` timestamp (soft-deleted)
- Could be accidental deletion by owner
- Could be automated cleanup process
- Could be admin action

**Impact:**
- **Severity:** High (User completely blocked from application)
- **User Impact:** Cannot access account or data
- **Business Impact:** Potential data loss perception, churn risk

**Resolution Steps:**

1. **Verify Account Soft-Deleted**
   ```sql
   -- Check if account deleted
   SELECT account_uuid, company_name, company_email, deleted_at
   FROM accounts
   WHERE company_email = 'user@example.com';
   ```

   **If deleted_at IS NOT NULL:**
   - Account soft-deleted
   - Proceed to restoration

   **Check User Record:**
   ```sql
   -- Check if user deleted
   SELECT user_uuid, account_uuid, user_email, deleted_at
   FROM users
   WHERE user_email = 'user@example.com';
   ```

2. **Determine Deletion Reason**
   - Check audit logs (if implemented)
   - Review deletion timestamp
   - Contact account owner (if user is not owner)
   - Verify if legitimate deletion or accidental

   **Questions to Ask:**
   - When was account deleted? (Check `deleted_at` timestamp)
   - Who initiated deletion? (Check audit logs for user_id)
   - Was deletion intentional?
   - Is data recovery needed?

3. **Restore Account (If Approved)**

   **Step 1: Restore Account Record**
   ```sql
   -- Restore account
   UPDATE accounts
   SET deleted_at = NULL,
       modified_at = NOW()
   WHERE account_uuid = 'account-uuid-here';
   ```

   **Step 2: Restore User Records**
   ```sql
   -- Restore all users for account
   UPDATE users
   SET deleted_at = NULL,
       modified_at = NOW()
   WHERE account_uuid = 'account-uuid-here';
   ```

   **Step 3: Restore Subscription (If Needed)**
   ```sql
   -- Restore subscription
   UPDATE subscriptions
   SET deleted_at = NULL,
       modified_at = NOW()
   WHERE account_uuid = 'account-uuid-here';
   ```

4. **Verify Restoration**
   ```sql
   -- Verify account visible
   SELECT * FROM accounts
   WHERE account_uuid = 'account-uuid-here'
     AND deleted_at IS NULL;

   -- Verify users visible
   SELECT * FROM users
   WHERE account_uuid = 'account-uuid-here'
     AND deleted_at IS NULL;
   ```

5. **Test User Login**
   - Ask user to attempt login
   - Verify authentication succeeds
   - Verify account data accessible
   - Verify subscription status correct

6. **Document Recovery**
   - Log restoration in support ticket
   - Note reason for deletion and restoration
   - Update audit trail (if implemented)

**Prevention:**
- Implement account deletion confirmation (double opt-in)
- Add "Are you sure?" warning for deletion
- Send email confirmation before permanent deletion
- Implement 30-day grace period before permanent deletion
- Add account recovery page for users

**User Communication:**
```
Subject: Account Restored

Hi [User],

Your account has been successfully restored.

Account Details:
- Email: [user@example.com]
- Account Name: [Company Name]
- Restored At: [Timestamp]

You can now login using your existing credentials:
[Login Link]

If you didn't request this restoration or have concerns, please contact us immediately.

Best regards,
Support Team
```

**Escalation:**
- If restoration fails due to data integrity issues → Escalate to engineering
- If unauthorized restoration request → Escalate to security team
- If data corruption detected → Escalate to database team

**Related Documentation:**
- [Soft Delete Pattern](../migration/AUTH_B2B_SCHEMA_MIGRATION.md#breaking-changes)

---

## Troubleshooting Procedures

### Procedure 1: Diagnose Slow Login Performance

**Goal:** Identify bottleneck in login flow causing > 2 second p95 latency

**Tools:**
- Browser DevTools (Network tab)
- Supabase Dashboard (Database performance)
- Application logs (correlation IDs)

**Steps:**

1. **Measure Login Flow Timing**
   ```javascript
   // Add to AuthProvider login method
   console.time('Login Flow');

   console.time('Supabase Auth');
   const { data: session } = await supabase.auth.signInWithPassword({email, password});
   console.timeEnd('Supabase Auth');

   console.time('Orphan Detection');
   const orphanResult = await checkIfOrphaned(session.user.id);
   console.timeEnd('Orphan Detection');

   console.time('Profile Enrichment');
   const user = await UserQueries.getUser(session.user.id);
   console.timeEnd('Profile Enrichment');

   console.time('Subscription Check');
   const subscription = await SubscriptionQueries.getAccountSubscription(accountUuid);
   console.timeEnd('Subscription Check');

   console.timeEnd('Login Flow');
   ```

2. **Identify Slow Phase**

   **Phase Performance Targets:**
   - Supabase Auth: < 500ms
   - Orphan Detection: < 200ms
   - Profile Enrichment: < 100ms (with JWT claims), < 150ms (fallback query)
   - Subscription Check: < 50ms (cached), < 300ms (cache miss)

3. **Diagnose Specific Phase**

   **If Orphan Detection Slow:**
   - See [Issue 3: Orphan Detection Failures](#issue-3-orphan-detection-failures)
   - Check database performance
   - Verify indexes exist

   **If Profile Enrichment Slow:**
   - Check if JWT claims present
   - See [Issue 1: JWT Claims Missing](#issue-1-jwt-claims-missing)
   - Verify RLS policies optimized

   **If Subscription Check Slow:**
   - Check cache hit rate
   - See [Issue 4: Subscription Status Errors](#issue-4-subscription-status-errors)
   - Verify cache configuration

4. **Optimize Identified Bottleneck**
   - Apply specific resolution from issue section
   - Measure improvement
   - Monitor over 24 hours

**Expected Outcome:** Login flow < 2000ms p95

---

### Procedure 2: Verify RLS Policy Isolation

**Goal:** Ensure zero cross-account data leakage

**Tools:**
- Supabase SQL Editor
- Browser DevTools (Console)
- Test user accounts

**Steps:**

1. **Create Two Test Accounts**
   ```sql
   -- Account A
   INSERT INTO accounts (account_uuid, company_name, company_email)
   VALUES (gen_random_uuid(), 'Test Account A', 'test-a@example.com');

   -- Account B
   INSERT INTO accounts (account_uuid, company_name, company_email)
   VALUES (gen_random_uuid(), 'Test Account B', 'test-b@example.com');
   ```

2. **Login as Account A User**
   - Authenticate in application
   - Note Account A UUID from user context

3. **Attempt Cross-Account Query**
   ```javascript
   // In browser console (logged in as Account A)
   const { data: accountBData } = await supabase
     .from('accounts')
     .select('*')
     .eq('account_uuid', 'account-b-uuid-here'); // Known Account B UUID

   console.log('Cross-Account Data:', accountBData);
   // ✅ Expected: Empty array []
   // ❌ Security Issue: Returns Account B data
   ```

4. **Test All Tables**
   ```javascript
   // Test accounts table
   const { data: accounts } = await supabase.from('accounts').select('*');
   console.log('Accounts:', accounts); // Should only show Account A

   // Test users table
   const { data: users } = await supabase.from('users').select('*');
   console.log('Users:', users); // Should only show Account A users

   // Test subscriptions table
   const { data: subs } = await supabase.from('subscriptions').select('*');
   console.log('Subscriptions:', subs); // Should only show Account A subscription
   ```

5. **Verify Zero Data Leakage**
   - All queries return ONLY Account A data
   - No Account B data visible
   - RLS policies working correctly

**If RLS Leakage Detected:**
- **CRITICAL SECURITY ISSUE**
- Immediately rollback deployment
- Review RLS policies in database
- Run penetration test suite
- Do NOT deploy until fixed

**Expected Outcome:** Perfect tenant isolation, zero cross-account access

---

### Procedure 3: Force Cache Invalidation for All Users

**Goal:** Clear stale subscription cache application-wide

**When to Use:**
- After bulk subscription updates
- After subscription schema changes
- After cache corruption detected

**Steps:**

1. **Backend Cache Invalidation**
   ```typescript
   // Create admin endpoint (protected by admin role)
   // POST /admin/cache/invalidate

   export async function POST() {
     const { queryClient } = useQueryClient();

     // Get all active users
     const { data: users } = await supabase
       .from('users')
       .select('account_uuid')
       .is('deleted_at', null);

     // Invalidate subscription cache for each account
     const accountUuids = [...new Set(users.map(u => u.account_uuid))];
     accountUuids.forEach(accountUuid => {
       queryClient.invalidateQueries(['subscription', accountUuid]);
     });

     return { success: true, invalidated: accountUuids.length };
   }
   ```

2. **Broadcast Cache Invalidation**
   ```typescript
   // Use Supabase Realtime to broadcast to all clients
   const channel = supabase.channel('cache-invalidation');

   channel.send({
     type: 'broadcast',
     event: 'invalidate-subscription-cache',
     payload: {}
   });
   ```

3. **Client-Side Listener**
   ```typescript
   // In AuthProvider or root component
   useEffect(() => {
     const channel = supabase.channel('cache-invalidation');

     channel.on('broadcast', { event: 'invalidate-subscription-cache' }, () => {
       // Invalidate local cache
       queryClient.invalidateQueries(['subscription']);
     });

     channel.subscribe();

     return () => {
       channel.unsubscribe();
     };
   }, []);
   ```

4. **Verify Invalidation**
   - Monitor cache hit rate drop to ~0%
   - Monitor database query rate spike temporarily
   - Cache hit rate should recover to > 80% within 5 minutes

**Expected Outcome:** Fresh subscription data for all users within 5 minutes

---

## Escalation Procedures

### Level 1: Support Team (First Response)

**Handles:**
- User questions about error messages
- Login/registration issues with known solutions
- Password resets
- Email uniqueness errors
- Trial status questions

**Escalate to Level 2 If:**
- Issue not in this runbook
- Database connectivity required
- RLS policy investigation needed
- Affecting > 5% of users

**Tools:**
- This runbook
- User communication templates
- Supabase Dashboard (read-only)

### Level 2: Engineering On-Call (Technical Issues)

**Handles:**
- Orphan detection failures
- RLS policy troubleshooting
- Database performance issues
- Cache invalidation
- Schema validation

**Escalate to Level 3 If:**
- Security incident (RLS leakage)
- Database corruption
- Requires schema changes
- Affecting > 20% of users

**Tools:**
- Full Supabase Dashboard access
- Database SQL access
- Application logs
- Monitoring dashboards

### Level 3: Tech Lead / Security Team (Critical Incidents)

**Handles:**
- Cross-account data leakage
- Database integrity issues
- Schema modification decisions
- Rollback authorization
- Post-mortem coordination

**Authority:**
- Approve emergency rollback
- Authorize schema hot-fixes
- Coordinate with Supabase support
- Emergency maintenance windows

---

## Recovery Procedures

### Procedure: Emergency Rollback

**See:** [Deployment Checklist - Rollback Procedure](../deployment/DEPLOYMENT_CHECKLIST.md#rollback-criteria)

**Quick Steps:**
1. Revert frontend deployment
2. Revert Edge Function deployment
3. Disable custom access token hook
4. Verify rollback success with E2E tests

### Procedure: Database Corruption Recovery

**Symptoms:**
- Constraint violations on valid data
- Data inconsistency between tables
- Foreign key violations

**Steps:**

1. **Stop All Writes**
   - Deploy read-only mode if available
   - Disable registration endpoint
   - Display maintenance message

2. **Identify Corruption**
   ```sql
   -- Check for orphaned users (users with invalid account_uuid)
   SELECT u.user_uuid, u.account_uuid, u.user_email
   FROM users u
   LEFT JOIN accounts a ON u.account_uuid = a.account_uuid
   WHERE a.account_uuid IS NULL
     AND u.deleted_at IS NULL;

   -- Check for orphaned subscriptions
   SELECT s.subscription_uuid, s.account_uuid
   FROM subscriptions s
   LEFT JOIN accounts a ON s.account_uuid = a.account_uuid
   WHERE a.account_uuid IS NULL
     AND s.deleted_at IS NULL;
   ```

3. **Contact Supabase Support**
   - Open priority support ticket
   - Provide database project ID
   - Describe corruption symptoms
   - Request point-in-time recovery if needed

4. **Restore from Backup (If Available)**
   - Supabase Pro: Point-in-time recovery
   - Self-hosted: Restore from last known good backup
   - Coordinate downtime with users

5. **Re-deploy After Recovery**
   - Verify data integrity
   - Run full test suite
   - Gradual rollout (10% → 50% → 100%)

---

## Performance Tuning

### Optimization 1: Database Connection Pooling

**Goal:** Reduce connection overhead

**Configuration:**
```typescript
// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    pool: {
      min: 2,
      max: 10
    }
  },
  global: {
    headers: { 'x-my-custom-header': 'my-app' }
  }
});
```

### Optimization 2: Query Result Caching

**Goal:** Reduce duplicate queries

**Implementation:**
```typescript
// Aggressive caching for rarely-changing data
const { data: account } = useQuery(
  ['account', accountUuid],
  () => AccountQueries.getAccount(accountUuid),
  {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000  // 1 hour
  }
);
```

### Optimization 3: Index Optimization

**Frequently Queried Columns:**
```sql
-- Add composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_users_account_email
ON users(account_uuid, user_email)
WHERE deleted_at IS NULL;

-- Add index for subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_account_status
ON subscriptions(account_uuid, status)
WHERE deleted_at IS NULL;
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-30
**Maintained By:** Operations Team
**Next Review:** After first month in production
