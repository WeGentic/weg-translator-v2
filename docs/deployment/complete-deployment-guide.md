# Complete Deployment Guide - Orphan Cleanup System

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Database Migrations](#2-database-migrations)
3. [Supabase Vault Configuration](#3-supabase-vault-configuration)
4. [Email Infrastructure Setup](#4-email-infrastructure-setup)
5. [Edge Function Deployment](#5-edge-function-deployment)
6. [Frontend Deployment](#6-frontend-deployment)
7. [Monitoring Setup](#7-monitoring-setup)
8. [Smoke Testing](#8-smoke-testing)
9. [Gradual Rollout Strategy](#9-gradual-rollout-strategy)
10. [Rollback Procedures](#10-rollback-procedures)

---

## 1. Pre-Deployment Checklist

### Prerequisites

- [ ] Supabase project configured (production)
- [ ] Database backup created and verified
- [ ] Staging environment fully tested
- [ ] All Phase 0-5 tasks completed
- [ ] Code review and security audit passed
- [ ] Monitoring dashboards created
- [ ] Alert configurations tested
- [ ] On-call engineer assigned
- [ ] Rollback procedures reviewed by team
- [ ] Stakeholders notified of deployment window

### Team Sign-Off

- [ ] Engineering Lead approval
- [ ] Product Manager approval
- [ ] Security Team approval (if required)
- [ ] DevOps/SRE review complete

---

## 2. Database Migrations

### Migration Files

All migrations located in: `supabase/migrations/`

#### Migration 20250128_001: Create verification_codes table

**File**: `20250128_001_create_verification_codes_table.sql`

```sql
-- Create verification_codes table for orphan cleanup codes
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL UNIQUE,
  code_hash BYTEA NOT NULL,
  code_salt BYTEA NOT NULL,
  correlation_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient cleanup of expired codes
CREATE INDEX idx_verification_codes_expires_at
  ON verification_codes(expires_at);

-- Index for email lookup
CREATE INDEX idx_verification_codes_email_hash
  ON verification_codes(email_hash);

COMMENT ON TABLE verification_codes IS 'Stores hashed verification codes for orphaned user cleanup';
COMMENT ON COLUMN verification_codes.email_hash IS 'SHA-256 hash of lowercase email';
COMMENT ON COLUMN verification_codes.code_hash IS 'SHA-256 hash of verification code + salt';
COMMENT ON COLUMN verification_codes.code_salt IS 'Random 16-byte salt for code hashing';
COMMENT ON COLUMN verification_codes.expires_at IS 'Expiry timestamp (5 minutes from creation)';
```

**Verification**:
```sql
-- Verify table created
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'verification_codes'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'verification_codes';
```

#### Migration 20250128_002: Create rate_limits table

**File**: `20250128_002_create_rate_limits_table.sql`

```sql
-- Create rate_limits table for sliding window rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  bucket_time TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, bucket_time)
);

-- Index for efficient window queries
CREATE INDEX idx_rate_limits_bucket_time
  ON rate_limits(bucket_time);

COMMENT ON TABLE rate_limits IS 'Stores rate limiting buckets for sliding window algorithm';
COMMENT ON COLUMN rate_limits.key IS 'Rate limit key: global:*, ip:<hash>, email:<hash>';
COMMENT ON COLUMN rate_limits.bucket_time IS 'Bucket timestamp (truncated to second)';
COMMENT ON COLUMN rate_limits.count IS 'Request count in this bucket';
```

**Verification**:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'rate_limits';
```

#### Migration 20250128_003: Create check_rate_limit function

**File**: `20250128_003_create_check_rate_limit_function.sql`

```sql
-- Create PostgreSQL function for rate limit checking
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, retry_after INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_retry_after INTEGER;
BEGIN
  -- Calculate window start time
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Get current count in window
  SELECT COALESCE(SUM(count), 0)
  INTO v_current_count
  FROM rate_limits
  WHERE key = p_key
    AND bucket_time >= v_window_start;

  -- Check if under limit
  IF v_current_count < p_limit THEN
    -- Increment count for current bucket (1-second granularity)
    INSERT INTO rate_limits (key, bucket_time, count)
    VALUES (p_key, DATE_TRUNC('second', NOW()), 1)
    ON CONFLICT (key, bucket_time)
    DO UPDATE SET count = rate_limits.count + 1;

    -- Return allowed
    RETURN QUERY SELECT TRUE, v_current_count + 1, 0;
  ELSE
    -- Calculate retry after (time until oldest bucket expires)
    SELECT CEIL(EXTRACT(EPOCH FROM (MIN(bucket_time) + (p_window_seconds || ' seconds')::INTERVAL - NOW())))::INTEGER
    INTO v_retry_after
    FROM rate_limits
    WHERE key = p_key
      AND bucket_time >= v_window_start;

    -- Return not allowed
    RETURN QUERY SELECT FALSE, v_current_count, GREATEST(v_retry_after, 1);
  END IF;
END;
$$;

COMMENT ON FUNCTION check_rate_limit IS 'Check rate limit and increment counter if allowed';
```

**Verification**:
```sql
-- Test rate limit function
SELECT * FROM check_rate_limit('test:key', 5, 60);

-- Expected: (true, 1, 0) for first call
-- Expected: (false, 6, X) after 6 calls
```

#### Migration 20250128_004: Create cleanup job for expired codes

**File**: `20250128_004_create_cleanup_job.sql`

```sql
-- Optional: Create periodic cleanup job for expired codes
-- Note: This can also be done via Supabase Dashboard or cron job

-- Function to clean up expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- Function to clean up old rate limit buckets
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete buckets older than 2 hours
  DELETE FROM rate_limits
  WHERE bucket_time < NOW() - INTERVAL '2 hours';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_verification_codes IS 'Remove expired verification codes (run periodically)';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Remove old rate limit buckets (run periodically)';
```

**Setup Periodic Cleanup** (Supabase Dashboard > Database > Cron Jobs):
```sql
-- Run every 5 minutes
SELECT cron.schedule('cleanup-expired-codes', '*/5 * * * *', 'SELECT cleanup_expired_verification_codes()');

-- Run every hour
SELECT cron.schedule('cleanup-old-rate-limits', '0 * * * *', 'SELECT cleanup_old_rate_limits()');
```

### Migration Execution

**Run All Migrations**:
```bash
# Connect to Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations to database
supabase db push

# Verify migrations applied
supabase db diff --schema public
```

**Manual Migration** (if needed):
```bash
# Run each migration file individually
psql $DATABASE_URL -f supabase/migrations/20250128_001_create_verification_codes_table.sql
psql $DATABASE_URL -f supabase/migrations/20250128_002_create_rate_limits_table.sql
psql $DATABASE_URL -f supabase/migrations/20250128_003_create_check_rate_limit_function.sql
psql $DATABASE_URL -f supabase/migrations/20250128_004_create_cleanup_job.sql
```

### Migration Rollback

**If migrations must be rolled back**:

```sql
-- Drop tables and functions (in reverse order)
DROP FUNCTION IF EXISTS cleanup_old_rate_limits();
DROP FUNCTION IF EXISTS cleanup_expired_verification_codes();
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER, INTEGER);
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS verification_codes CASCADE;
```

---

## 3. Supabase Vault Configuration

### Setup Service Role Key in Vault

**Step 1: Access Vault**
1. Navigate to Supabase Dashboard
2. Select your project
3. Go to: **Settings > Vault**

**Step 2: Create Secret**
1. Click **New Secret**
2. **Name**: `SUPABASE_SERVICE_ROLE_KEY`
3. **Value**: Paste service role key from **Settings > API > service_role secret**
4. **Description**: "Service role key for cleanup-orphaned-user edge function"
5. **Tags**: `production`, `security`, `edge-functions`
6. Click **Save**

**Step 3: Set Access Permissions**
1. Click on secret name
2. **Access Control**: Select "Edge Functions Only"
3. Save changes

**Step 4: Verify Access**
```bash
# Deploy test edge function that reads Vault secret
supabase functions deploy test-vault-access

# Invoke function
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/test-vault-access

# Expected: Success response (not auth error)
```

### Development Environment Fallback

For local development, edge functions can fall back to environment variables:

```typescript
// In edge function
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? // Vault injection (production)
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY_LOCAL'); // Local dev fallback

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in Vault or environment');
}

// Log warning if using local env var
if (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY_LOCAL')) {
  console.warn('Using local service role key (development mode)');
}
```

---

## 4. Email Infrastructure Setup

### DNS Configuration

#### SPF Record

**Record Type**: TXT
**Name**: `@` (or your root domain)
**Value**: `v=spf1 include:spf.resend.com include:sendgrid.net ~all`
**TTL**: 3600

**Verification**:
```bash
dig TXT yourdomain.com | grep spf1

# Expected output includes:
# yourdomain.com. 3600 IN TXT "v=spf1 include:spf.resend.com include:sendgrid.net ~all"
```

#### DKIM Records (Resend)

**Record Type**: TXT
**Name**: `resend._domainkey` (obtain from Resend Dashboard)
**Value**: (obtain from Resend Dashboard)
**TTL**: 3600

**Setup**:
1. Login to Resend Dashboard
2. Navigate to **Domains > Add Domain**
3. Enter: `auth.yourdomain.com` (dedicated subdomain)
4. Copy DKIM records
5. Add to DNS provider

**Verification**:
```bash
dig TXT resend._domainkey.auth.yourdomain.com

# Expected: DKIM public key
```

#### DKIM Records (SendGrid)

**Record Type**: CNAME
**Name**: `s1._domainkey` and `s2._domainkey`
**Value**: (obtain from SendGrid Dashboard)
**TTL**: 3600

**Setup**:
1. Login to SendGrid Dashboard
2. Navigate to **Settings > Sender Authentication**
3. Add domain: `auth.yourdomain.com`
4. Copy CNAME records
5. Add to DNS provider

**Verification**:
```bash
dig CNAME s1._domainkey.auth.yourdomain.com
dig CNAME s2._domainkey.auth.yourdomain.com
```

#### DMARC Record

**Record Type**: TXT
**Name**: `_dmarc`
**Value**: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; pct=100`
**TTL**: 3600

**Note**: Start with `p=none` for monitoring, then upgrade to `p=quarantine` or `p=reject` after verifying compliance.

**Verification**:
```bash
dig TXT _dmarc.yourdomain.com

# Expected:
# _dmarc.yourdomain.com. 3600 IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; pct=100"
```

### Email Provider Configuration

#### Resend Setup

1. **API Key**: Generate in Resend Dashboard > API Keys
2. **Store in Vault**: `RESEND_API_KEY`
3. **Verify Domain**: Complete domain verification in Resend
4. **Test Email**:
   ```bash
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "from": "noreply@auth.yourdomain.com",
       "to": "test@yourdomain.com",
       "subject": "Test Email",
       "text": "This is a test"
     }'
   ```

#### SendGrid Setup

1. **API Key**: Generate in SendGrid Dashboard > Settings > API Keys
2. **Store in Vault**: `SENDGRID_API_KEY`
3. **Sender Authentication**: Complete domain verification
4. **Test Email**:
   ```bash
   curl -X POST https://api.sendgrid.com/v3/mail/send \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "personalizations": [{"to": [{"email": "test@yourdomain.com"}]}],
       "from": {"email": "noreply@auth.yourdomain.com"},
       "subject": "Test Email",
       "content": [{"type": "text/plain", "value": "This is a test"}]
     }'
   ```

### Email Template

Create verification code email template:

**Subject**: "Verification Code for Account Cleanup"

**Body** (text):
```
Hello,

Your verification code for account cleanup is:

XXXX-XXXX

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

Best regards,
The Team at YourCompany
```

**Body** (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Verification Code for Account Cleanup</h2>
    <p>Hello,</p>
    <p>Your verification code for account cleanup is:</p>
    <div style="background: #f4f4f4; border: 2px solid #ddd; border-radius: 5px; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
      XXXX-XXXX
    </div>
    <p><strong>This code will expire in 5 minutes.</strong></p>
    <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #999;">
      Best regards,<br>
      The Team at YourCompany
    </p>
  </div>
</body>
</html>
```

---

## 5. Edge Function Deployment

### Deploy cleanup-orphaned-user

```bash
# Navigate to project root
cd /path/to/weg-translator

# Deploy function
supabase functions deploy cleanup-orphaned-user

# Verify deployment
supabase functions list

# Expected output:
# NAME                    STATUS    VERSION
# cleanup-orphaned-user   active    1
```

### Deploy check-email-status (enhanced)

```bash
# Deploy enhanced version with orphan detection
supabase functions deploy check-email-status

# Verify
supabase functions list
```

### Test Edge Functions

**Test cleanup-orphaned-user (request code)**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{
    "step": "request-code",
    "email": "test@example.com"
  }'

# Expected: 404 with ORPHAN_CLEANUP_004 (user not found) - expected for test email
```

**Test check-email-status**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "test@example.com"
  }'

# Expected: 200 OK with status="not_registered"
```

---

## 6. Frontend Deployment

### Environment Variables

**Staging**:
```env
VITE_ORPHAN_CLEANUP_ENABLED=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

**Production** (initially disabled):
```env
VITE_ORPHAN_CLEANUP_ENABLED=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Build and Deploy

```bash
# Build production bundle
npm run build

# Verify build
ls -lh dist/

# Deploy to hosting provider (example: Vercel)
vercel deploy --prod

# Or: Netlify
netlify deploy --prod

# Or: Manual upload to S3/CloudFront
aws s3 sync dist/ s3://your-bucket/ --delete
aws cloudfront create-invalidation --distribution-id XXXX --paths "/*"
```

### Feature Flag Management

**Feature Flag Check** (in code):
```typescript
// src/app/config.ts
export const FEATURE_FLAGS = {
  ORPHAN_CLEANUP_ENABLED:
    import.meta.env.VITE_ORPHAN_CLEANUP_ENABLED === 'true',
};

// Usage in components
if (FEATURE_FLAGS.ORPHAN_CLEANUP_ENABLED) {
  // Orphan detection and cleanup flows enabled
} else {
  // Legacy behavior
}
```

---

## 7. Monitoring Setup

### Create Dashboards

#### Dashboard 1: Orphan Detection Health (Grafana/Datadog/Supabase)

**Panels**:
1. **Detection Duration (p50, p95, p99)**: Line chart, 24h window
2. **Detection Error Rate**: Gauge (target: <1%, warning: >3%, critical: >5%)
3. **Timeout Rate**: Gauge
4. **Graceful Degradation Rate**: Line chart
5. **Orphan vs Non-Orphan Count**: Bar chart

**Queries** (adjust for your monitoring system):
```sql
-- Detection duration percentiles
SELECT
  DATE_TRUNC('minute', created_at) AS time,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99
FROM orphan_detection_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time;
```

#### Dashboard 2: Cleanup Operations

**Panels**:
1. **Cleanup Request Volume**: Bar chart (requests/hour)
2. **Success Rate**: Gauge (target: >98%, warning: <95%, critical: <90%)
3. **Error Code Distribution**: Pie chart
4. **Average Cleanup Time**: Line chart (p50, p95)
5. **Email Delivery Rate**: Gauge

**Queries**:
```sql
-- Success rate
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate
FROM auth_cleanup_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### Configure Alerts

**PagerDuty Integration** (Critical Alerts):
```yaml
- name: orphan-detection-high-error-rate
  condition: error_rate > 10% for 5 minutes
  severity: critical
  notify: pagerduty + slack-incidents

- name: cleanup-success-rate-critical
  condition: success_rate < 90% for 10 minutes
  severity: critical
  notify: pagerduty + slack-incidents

- name: global-rate-limit-exhausted
  condition: hits > 5 in 1 hour
  severity: critical
  notify: pagerduty + slack-security
```

**Slack Integration** (Warning Alerts):
```yaml
- name: orphan-detection-slow
  condition: p95_duration > 300ms for 15 minutes
  severity: warning
  notify: slack-engineering-alerts

- name: email-bounce-rate-high
  condition: bounce_rate > 0.5% for 1 hour
  severity: warning
  notify: slack-engineering-alerts
```

---

## 8. Smoke Testing

### Test Suite

**Test 1: Request Verification Code (Orphaned User)**
```bash
# Create test orphaned user manually
# Then request code
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{
    "step": "request-code",
    "email": "orphaned-test@example.com"
  }'

# Expected: 200 OK with "Verification code sent to email"
# Check: Email received, code in verification_codes table
```

**Test 2: Validate Code and Delete User**
```bash
# Use code from email
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{
    "step": "validate-and-cleanup",
    "email": "orphaned-test@example.com",
    "verificationCode": "ABCD-EFGH"
  }'

# Expected: 200 OK with "User deleted successfully"
# Check: User removed from auth.users, auth_cleanup_log status='completed'
```

**Test 3: Email Status Probe (Orphan Detection)**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "orphaned-test@example.com"
  }'

# Expected: status="registered_verified", isOrphaned=true
```

**Test 4: Login Flow Orphan Detection**
1. Create orphaned user (email verified, no company data)
2. Attempt login via UI
3. Expected: Redirected to `/register/recover` with toast notification
4. Verify: auth_cleanup_log entry created with status='pending'

**Test 5: Rate Limiting**
```bash
# Send 6 requests rapidly from same IP
for i in {1..6}; do
  curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-orphaned-user \
    -H "Content-Type: application/json" \
    -d '{"step":"request-code","email":"test@example.com"}'
  echo "Request $i"
done

# Expected: First 5 succeed (or fail with valid errors), 6th returns 429 with retryAfter
```

**Test 6: Constant-Time Response**
```bash
# Measure response times for valid and invalid inputs
# Should be similar (~500ms ±100ms)
time curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{"step":"validate-and-cleanup","email":"test@example.com","verificationCode":"INVALID1"}'

time curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{"step":"validate-and-cleanup","email":"nonexistent@example.com","verificationCode":"INVALID2"}'

# Expected: Both responses within ~500ms ±100ms (accounting for network)
```

---

## 9. Gradual Rollout Strategy

### Phase 1: Staging Validation (1-2 days)

- [x] All migrations applied
- [x] Edge functions deployed
- [x] Frontend deployed with feature flag enabled
- [x] Smoke tests pass
- [ ] Load test (simulate 100 concurrent users)
- [ ] Security test (attempt timing attacks, rate limit bypass)
- [ ] Monitor for 48 hours with synthetic traffic

### Phase 2: Production Infrastructure (Day 1)

- [ ] Deploy database migrations to production
- [ ] Configure Supabase Vault
- [ ] Deploy edge functions to production
- [ ] Verify DNS records propagated
- [ ] Configure email providers
- [ ] Set up monitoring dashboards
- [ ] Configure alerts (test with fake data)

### Phase 3: Frontend Deploy (Feature Flag OFF) (Day 2)

- [ ] Deploy frontend with `VITE_ORPHAN_CLEANUP_ENABLED=false`
- [ ] Verify no breaking changes to existing flows
- [ ] Monitor error rates, performance metrics
- [ ] Confirm feature flag correctly disables new code

### Phase 4: Gradual Rollout (Days 3-10)

**Day 3-4: Internal Testing (0.1%)**
- [ ] Enable feature for internal test users only
- [ ] Test all flows: login, registration, recovery
- [ ] Monitor closely for any issues
- [ ] Gather feedback from internal users

**Day 5-6: 10% Rollout**
- [ ] Update feature flag to enable for 10% of users (A/B test)
- [ ] Monitor metrics:
  - Orphan detection performance (p95 < 200ms?)
  - Cleanup success rate (>98%?)
  - Error rates (<1%?)
  - Email bounce rates (<0.3%?)
- [ ] Review user feedback/support tickets

**Day 7-8: 50% Rollout**
- [ ] Increase to 50% of users
- [ ] Continue monitoring
- [ ] Check for unexpected patterns
- [ ] Ensure no alerts firing

**Day 9-10: 100% Rollout**
- [ ] Enable for all users: `VITE_ORPHAN_CLEANUP_ENABLED=true`
- [ ] Deploy frontend
- [ ] Monitor closely for 48 hours
- [ ] Celebrate successful launch! 🎉

### Rollout Decision Criteria

**Proceed to next phase if**:
- ✅ Error rate < 1%
- ✅ Success rate > 98%
- ✅ p95 latency < 300ms
- ✅ No critical alerts
- ✅ No user-reported blockers

**Rollback if**:
- ❌ Error rate > 5%
- ❌ Success rate < 90%
- ❌ p95 latency > 1000ms
- ❌ Critical alerts firing
- ❌ Multiple user-reported blockers

---

## 10. Rollback Procedures

### Emergency Rollback (Immediate)

**Trigger**: Critical issue detected (error rate >10%, system down)

**Step 1: Disable Feature Flag (Fastest)**
```bash
# Update environment variable in hosting provider
VITE_ORPHAN_CLEANUP_ENABLED=false

# Redeploy frontend (or update config if hot-reloadable)
vercel deploy --prod

# Estimated time: 2-5 minutes
```

**Step 2: Verify Rollback**
- Check error rates return to normal
- Verify users can login/register with old flow
- Monitor for residual issues

**Step 3: Communicate**
- Post in #incidents Slack channel
- Notify stakeholders
- Update status page (if applicable)

### Partial Rollback (Targeted)

**Trigger**: Issue affecting specific component only

**Option A: Disable Orphan Detection Only**
```typescript
// Quick code patch (if feature flag granularity insufficient)
// In AuthProvider.login()
const ENABLE_ORPHAN_DETECTION = false; // Temporarily disable

if (ENABLE_ORPHAN_DETECTION) {
  await checkIfOrphaned(userId);
}
```

**Option B: Disable Email Probe Only**
```typescript
// In useEmailStatusProbe
const ENABLE_EMAIL_PROBE = false; // Temporarily disable

if (!ENABLE_EMAIL_PROBE) {
  return { phase: 'disabled', result: null };
}
```

### Full Rollback (Planned)

**Trigger**: Persistent issues requiring full removal

**Step 1: Disable Feature Flag**
```bash
VITE_ORPHAN_CLEANUP_ENABLED=false
vercel deploy --prod
```

**Step 2: Remove Edge Functions** (optional, if causing backend issues)
```bash
supabase functions delete cleanup-orphaned-user

# Revert check-email-status to previous version (without orphan detection)
git checkout main~1 -- supabase/functions/check-email-status/
supabase functions deploy check-email-status
```

**Step 3: Revert Frontend Code** (optional, if code causing issues)
```bash
# Revert to previous commit
git revert HEAD

# Or: Revert to specific commit before orphan cleanup
git revert <commit-hash>

# Build and deploy
npm run build
vercel deploy --prod
```

**Step 4: Database Rollback** (ONLY IF ABSOLUTELY NECESSARY)
```bash
# Warning: This will delete all cleanup logs and rate limit data

psql $DATABASE_URL <<EOF
DROP FUNCTION IF EXISTS cleanup_old_rate_limits();
DROP FUNCTION IF EXISTS cleanup_expired_verification_codes();
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER, INTEGER);
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS verification_codes CASCADE;
EOF
```

**⚠️ Database Rollback Considerations**:
- Loss of audit trail (auth_cleanup_log entries)
- Rate limit data lost (acceptable, rebuilds quickly)
- Verification codes lost (acceptable, users can request new)
- **Do NOT rollback if any data is needed for investigation**

### Post-Rollback Actions

**Immediate** (within 1 hour):
- [ ] Verify system stability
- [ ] Monitor error rates, performance
- [ ] Gather logs and metrics for investigation
- [ ] Document rollback reason and evidence

**Short-term** (within 24 hours):
- [ ] Conduct blameless postmortem
- [ ] Identify root cause
- [ ] Create action items for fixes
- [ ] Update deployment checklist to prevent recurrence

**Medium-term** (within 1 week):
- [ ] Implement fixes
- [ ] Test thoroughly in staging
- [ ] Plan re-deployment with fixes
- [ ] Update documentation with lessons learned

---

## Appendix: Testing Procedures

### Creating Test Orphaned Users

**Manually Create Orphaned User**:
```sql
-- Step 1: Create user in auth.users
-- (Use Supabase Dashboard > Authentication > Users > Invite User)
-- Or via API:
-- supabase.auth.admin.createUser({ email: 'orphaned-test@example.com', password: 'test123', email_confirm: true })

-- Step 2: Verify user has no company data
SELECT
  u.id,
  u.email,
  c.id AS company_id,
  ca.admin_uuid
FROM auth.users u
LEFT JOIN public.companies c ON c.owner_admin_uuid = u.id
LEFT JOIN public.company_admins ca ON ca.admin_uuid = u.id
WHERE u.email = 'orphaned-test@example.com';

-- Expected: company_id = NULL, admin_uuid = NULL
```

### Load Testing

```bash
# Use k6 for load testing
k6 run scripts/load-test-orphan-cleanup.js

# Sample k6 script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 100, // 100 virtual users
  duration: '5m',
};

export default function () {
  let url = 'https://YOUR_PROJECT.supabase.co/functions/v1/check-email-status';
  let payload = JSON.stringify({ email: 'test@example.com' });
  let params = { headers: { 'Content-Type': 'application/json' } };

  let res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-01-28
**Owner**: Engineering Team
**Review Before Each Deployment**
