# Orphan Cleanup Operations Runbook

## Overview

This runbook provides operational procedures for monitoring, investigating, and maintaining the orphaned user detection and cleanup system. It is intended for DevOps engineers, SREs, and support staff responsible for system health and incident response.

**System Components**:
- **Orphan Detection**: Frontend and login flow detection of incomplete registrations
- **Cleanup Edge Function**: `cleanup-orphaned-user` (two-step verification flow)
- **Email Status API**: `check-email-status` (registration-time orphan detection)
- **Database**: PostgreSQL tables (`verification_codes`, `rate_limits`, `auth_cleanup_log`)
- **Email Providers**: Resend (primary), SendGrid (fallback)

**Key Contacts**:
- **On-Call Engineer**: [PagerDuty rotation]
- **Engineering Lead**: [Name/Slack handle]
- **Supabase Support**: support@supabase.com

---

## 1. Monitoring Procedures

### 1.1 Key Metrics to Monitor

#### Orphan Detection Performance

| Metric | Target | Warning Threshold | Critical Threshold |
|--------|--------|-------------------|-------------------|
| **Detection Duration (p50)** | <100ms | >150ms | >200ms |
| **Detection Duration (p95)** | <200ms | >300ms | >500ms |
| **Detection Duration (p99)** | <500ms | >700ms | >1000ms |
| **Timeout Rate** | <1% | >3% | >5% |
| **Error Rate** | <1% | >3% | >5% |
| **Graceful Degradation Rate** | <2% | >5% | >10% |

**Dashboard Query** (Supabase Logs or Custom Analytics):
```sql
-- Orphan detection performance summary (last 24 hours)
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS total_detections,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms,
  SUM(CASE WHEN timed_out THEN 1 ELSE 0 END) AS timeout_count,
  SUM(CASE WHEN had_error THEN 1 ELSE 0 END) AS error_count
FROM orphan_detection_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

#### Cleanup Success Rate

| Metric | Target | Warning Threshold | Critical Threshold |
|--------|--------|-------------------|-------------------|
| **Cleanup Success Rate** | >98% | <95% | <90% |
| **Code Request Success Rate** | >99% | <97% | <95% |
| **Email Delivery Success Rate** | >99% | <97% | <95% |
| **Email Bounce Rate** | <0.3% | >0.5% | >1.0% |
| **Average Cleanup Time** | <2 minutes | >5 minutes | >10 minutes |

**Dashboard Query**:
```sql
-- Cleanup success rate (last 24 hours)
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS total_attempts,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate_pct
FROM auth_cleanup_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

#### Error Code Distribution

```sql
-- Error code breakdown (last 24 hours)
SELECT
  error_code,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM auth_cleanup_log
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

**Common Error Codes**:
- `ORPHAN_CLEANUP_001`: Code expired (user took >5 minutes)
- `ORPHAN_CLEANUP_002`: Invalid code entered
- `ORPHAN_CLEANUP_003`: Rate limited
- `ORPHAN_CLEANUP_005`: User completed registration between steps
- `ORPHAN_CLEANUP_008`: Email delivery failed

#### Rate Limiting Metrics

| Metric | Target | Warning Threshold | Critical Threshold |
|--------|--------|-------------------|-------------------|
| **Rate Limit Hit Rate** | <0.1% | >1% | >5% |
| **Unique IPs Hitting Limits** | <10/hour | >50/hour | >100/hour |
| **Global Limit Reached** | Never | 1x/hour | >5x/hour |

**Dashboard Query**:
```sql
-- Rate limit hits (last 24 hours)
SELECT
  DATE_TRUNC('hour', bucket_time) AS hour,
  key AS rate_limit_key,
  COUNT(*) AS hit_count
FROM rate_limits
WHERE bucket_time > NOW() - INTERVAL '24 hours'
  AND count >= (
    CASE
      WHEN key LIKE 'global:%' THEN 1000
      WHEN key LIKE 'ip:%' THEN 5
      WHEN key LIKE 'email:%' THEN 3
    END
  )
GROUP BY hour, key
ORDER BY hour DESC, hit_count DESC;
```

### 1.2 Alert Configuration

#### Critical Alerts (PagerDuty, immediate response)

```yaml
# Alert: Orphan Detection High Error Rate
condition: error_rate > 10% for 5 minutes
severity: critical
notification: PagerDuty + Slack #incidents
message: "Orphan detection error rate critical: {{ error_rate }}% (threshold: 10%)"
runbook: "#31-high-error-rate"

# Alert: Cleanup Success Rate Critical
condition: success_rate < 90% for 10 minutes
severity: critical
notification: PagerDuty + Slack #incidents
message: "Cleanup success rate critical: {{ success_rate }}% (threshold: 90%)"
runbook: "#32-low-success-rate"

# Alert: Global Rate Limit Exhausted
condition: global_rate_limit_reached > 5 times in 1 hour
severity: critical
notification: PagerDuty + Slack #security
message: "Global rate limit exhausted multiple times - possible attack"
runbook: "#33-rate-limit-attack"
```

#### Warning Alerts (Slack only, review next business day)

```yaml
# Alert: Orphan Detection Slow
condition: p95_duration_ms > 300ms for 15 minutes
severity: warning
notification: Slack #engineering-alerts
message: "Orphan detection p95 latency elevated: {{ p95_duration_ms }}ms (threshold: 300ms)"
runbook: "#34-slow-detection"

# Alert: Email Bounce Rate High
condition: bounce_rate > 0.5% for 1 hour
severity: warning
notification: Slack #engineering-alerts
message: "Email bounce rate elevated: {{ bounce_rate }}% (threshold: 0.5%)"
runbook: "#35-email-issues"

# Alert: Graceful Degradation High
condition: degradation_rate > 5% for 15 minutes
severity: warning
notification: Slack #engineering-alerts
message: "High graceful degradation rate: {{ degradation_rate }}% (threshold: 5%)"
runbook: "#36-query-performance"
```

### 1.3 Dashboard Setup

#### Recommended Dashboards

**Dashboard 1: Orphan Detection Health**
- **Panel 1**: Orphan detection duration (p50, p95, p99) - line chart, 24h window
- **Panel 2**: Detection error rate - gauge, current value vs threshold
- **Panel 3**: Timeout rate - gauge, current value vs threshold
- **Panel 4**: Orphan detection count - bar chart, orphaned vs non-orphaned
- **Panel 5**: Graceful degradation rate - line chart, 24h window

**Dashboard 2: Cleanup Operations**
- **Panel 1**: Cleanup request volume - bar chart, requests per hour
- **Panel 2**: Cleanup success rate - gauge, current value vs threshold
- **Panel 3**: Error code distribution - pie chart, last 24h
- **Panel 4**: Average cleanup time - line chart, p50/p95
- **Panel 5**: Email delivery success rate - gauge, current value

**Dashboard 3: Security & Rate Limiting**
- **Panel 1**: Rate limit hit count - bar chart, by tier (global, IP, email)
- **Panel 2**: Unique IPs hitting limits - line chart, 24h window
- **Panel 3**: Failed validation attempts - heatmap, by hour and error code
- **Panel 4**: Concurrent cleanup attempts - line chart, 24h window

---

## 2. Investigation Procedures

### 2.1 Tracing Requests with Correlation IDs

Every orphan detection and cleanup operation includes a correlation ID for end-to-end tracing.

**Find All Operations for a Correlation ID**:
```sql
-- Search auth_cleanup_log
SELECT
  correlation_id,
  email_hash,
  status,
  error_code,
  error_message,
  created_at,
  updated_at
FROM auth_cleanup_log
WHERE correlation_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at;

-- Search edge function logs (Supabase Dashboard)
-- Navigate to: Functions > cleanup-orphaned-user > Logs
-- Filter: correlation_id:"123e4567-e89b-12d3-a456-426614174000"
```

**Timeline Reconstruction**:
1. **T0**: User attempts login or registration (frontend log)
2. **T1**: Orphan detection query started (performance.now())
3. **T2**: Orphan detection completed (performance.now())
4. **T3**: Cleanup initiated (edge function invoked)
5. **T4**: Verification code sent (ESP log)
6. **T5**: User enters code (edge function invoked)
7. **T6**: User deleted (auth.admin.deleteUser log)
8. **T7**: auth_cleanup_log updated to 'completed'

### 2.2 Identifying Orphaned Users

**Query All Current Orphaned Users**:
```sql
-- Find users with verified emails but no company data
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  u.last_sign_in_at,
  EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 3600 AS hours_since_creation
FROM auth.users u
LEFT JOIN public.companies c ON c.owner_admin_uuid = u.id
LEFT JOIN public.company_admins ca ON ca.admin_uuid = u.id
WHERE u.email_confirmed_at IS NOT NULL
  AND c.id IS NULL
  AND ca.admin_uuid IS NULL
ORDER BY u.created_at DESC;
```

**Query Orphaned Users by Age**:
```sql
-- Find orphaned users older than 7 days (likely stuck)
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  DATE_PART('day', NOW() - u.created_at) AS days_old
FROM auth.users u
LEFT JOIN public.companies c ON c.owner_admin_uuid = u.id
LEFT JOIN public.company_admins ca ON ca.admin_uuid = u.id
WHERE u.email_confirmed_at IS NOT NULL
  AND c.id IS NULL
  AND ca.admin_uuid IS NULL
  AND u.created_at < NOW() - INTERVAL '7 days'
ORDER BY u.created_at;
```

### 2.3 Investigating Failed Cleanup Operations

**Query Failed Cleanups by Error Code**:
```sql
SELECT
  error_code,
  COUNT(*) AS count,
  array_agg(DISTINCT error_message) AS unique_messages,
  MAX(created_at) AS most_recent
FROM auth_cleanup_log
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

**Investigate Specific Failure**:
```sql
-- Get full details for a failed operation
SELECT
  correlation_id,
  email_hash,
  ip_hash,
  status,
  error_code,
  error_message,
  created_at,
  updated_at,
  updated_at - created_at AS duration
FROM auth_cleanup_log
WHERE status = 'failed'
  AND correlation_id = '123e4567-e89b-12d3-a456-426614174000';
```

**Common Failure Patterns**:

| Error Code | Likely Cause | Investigation Steps |
|------------|--------------|---------------------|
| `ORPHAN_CLEANUP_001` | Code expired (>5 minutes) | Check if user is receiving emails promptly |
| `ORPHAN_CLEANUP_002` | Invalid code entered | Check for user confusion, typo, or phishing |
| `ORPHAN_CLEANUP_003` | Rate limited | Check if legitimate user or abuse |
| `ORPHAN_CLEANUP_005` | User completed registration | Expected - race condition handled correctly |
| `ORPHAN_CLEANUP_006` | Database error | Check database health, connection pool |
| `ORPHAN_CLEANUP_008` | Email delivery failed | Check ESP status, bounce rate, DNS records |

### 2.4 Manual Cleanup Procedure

**⚠️ Use only when automatic cleanup fails and user contacts support**

**Step 1: Verify User is Orphaned**
```sql
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  c.id AS company_id,
  ca.admin_uuid AS admin_record
FROM auth.users u
LEFT JOIN public.companies c ON c.owner_admin_uuid = u.id
LEFT JOIN public.company_admins ca ON ca.admin_uuid = u.id
WHERE u.email = 'user@example.com';

-- Expected result for orphaned user:
-- company_id: NULL
-- admin_record: NULL
```

**Step 2: Delete User via Supabase Dashboard**
1. Navigate to: **Authentication > Users**
2. Search for email: `user@example.com`
3. Click on user row
4. Click **Delete User** button
5. Confirm deletion

**Step 3: Log Manual Cleanup**
```sql
INSERT INTO auth_cleanup_log (
  email_hash,
  ip_hash,
  correlation_id,
  status,
  error_message,
  created_at,
  updated_at
) VALUES (
  encode(digest('user@example.com', 'sha256'), 'hex'),
  NULL,
  gen_random_uuid(),
  'completed',
  'Manual cleanup by support staff - ticket #12345',
  NOW(),
  NOW()
);
```

**Step 4: Notify User**
Send email to user:
```
Subject: Account Cleanup Complete

Hi,

Your account cleanup request has been processed manually by our support team.
You can now register again at https://app.yourdomain.com/register

If you have any questions, please reply to this email referencing ticket #12345.

Best regards,
Support Team
```

---

## 3. Service Role Key Rotation

### 3.1 Rotation Procedure

**Frequency**: Every 90 days or immediately after suspected compromise

**Step 1: Generate New Service Role Key**
1. Navigate to: **Supabase Dashboard > Settings > API**
2. Click **Reset Service Role Key**
3. Copy new key (shown once only)
4. Store securely in password manager

**Step 2: Update Supabase Vault**
1. Navigate to: **Supabase Dashboard > Vault**
2. Find secret: `SUPABASE_SERVICE_ROLE_KEY`
3. Click **Edit**
4. Paste new key value
5. Click **Save**

**Step 3: Redeploy Edge Functions**
```bash
# Redeploy cleanup-orphaned-user (picks up new Vault secret)
supabase functions deploy cleanup-orphaned-user

# Verify deployment
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{"step":"request-code","email":"test@example.com"}'

# Expected: Error response (test email not found), not auth error
```

**Step 4: Verify All Functions**
```bash
# Test check-email-status
curl -X POST https://your-project.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Expected: 200 OK with status="not_registered"
```

**Step 5: Monitor for Errors**
- Check edge function logs for auth errors
- Monitor error rate in dashboards
- Verify cleanup operations succeed

**Rollback Procedure** (if new key causes issues):
1. Navigate to: **Supabase Dashboard > Vault**
2. Edit `SUPABASE_SERVICE_ROLE_KEY`
3. Restore previous key value
4. Redeploy edge functions: `supabase functions deploy cleanup-orphaned-user`
5. Investigate why new key failed

### 3.2 Key Compromise Response

**If Service Role Key is Compromised**:

1. **Immediate Actions** (within 5 minutes):
   - Reset service role key in Supabase Dashboard
   - Update Vault secret
   - Redeploy all edge functions
   - Review recent `auth_cleanup_log` for suspicious activity

2. **Investigation** (within 1 hour):
   - Check for unauthorized user deletions
   - Review edge function logs for unusual patterns
   - Check rate limit violations from unknown IPs
   - Query database for anomalies

3. **Remediation** (within 4 hours):
   - Contact affected users if any unauthorized deletions
   - Update security documentation
   - File incident report
   - Review access controls

---

## 4. Rate Limit Management

### 4.1 Current Rate Limits

| Tier | Limit | Window | Scope |
|------|-------|--------|-------|
| **Global** | 1000 requests | 60 seconds | All cleanup requests |
| **Per-IP** | 5 requests | 60 seconds | Source IP address |
| **Per-Email** | 3 requests | 60 minutes | Email address |

### 4.2 Adjusting Rate Limits

**When to Adjust**:
- **Increase**: High legitimate traffic, upcoming marketing campaign, low abuse
- **Decrease**: Under attack, high abuse rate, cost concerns

**Adjustment Procedure**:

**Option 1: Update PostgreSQL Function**
```sql
-- Edit check_rate_limit function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,  -- Change this parameter
  p_window_seconds INTEGER  -- Or this one
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, retry_after INTEGER)
AS $$
  -- Function body remains same
$$ LANGUAGE plpgsql;
```

**Option 2: Update Edge Function Constants**
```typescript
// In cleanup-orphaned-user/index.ts
const RATE_LIMITS = {
  GLOBAL: { limit: 1000, window: 60 },    // Adjust here
  IP: { limit: 5, window: 60 },           // Adjust here
  EMAIL: { limit: 3, window: 3600 },      // Adjust here
};
```

**Testing After Adjustment**:
```bash
# Test new limit (example: increased IP limit to 10)
for i in {1..11}; do
  curl -X POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-user \
    -H "Content-Type: application/json" \
    -d '{"step":"request-code","email":"test@example.com"}'
  echo "Request $i"
done

# Expected: First 10 succeed, 11th returns 429
```

**Monitor After Adjustment**:
- Check rate limit hit rate (should decrease if increased limits)
- Monitor abuse patterns
- Review cost impact (if increased limits significantly)

### 4.3 Responding to Rate Limit Attacks

**Signs of Attack**:
- Sudden spike in rate limit hits (>100/hour)
- Many unique IPs hitting limits simultaneously
- Global rate limit exhausted multiple times
- High percentage of `ORPHAN_CLEANUP_003` errors

**Response Procedure**:

**Step 1: Identify Attack Pattern**
```sql
-- Find IPs hitting limits
SELECT
  SUBSTRING(key FROM 'ip:(.*)') AS attacker_ip,
  COUNT(*) AS hit_count,
  MAX(bucket_time) AS most_recent
FROM rate_limits
WHERE key LIKE 'ip:%'
  AND bucket_time > NOW() - INTERVAL '1 hour'
  AND count >= 5
GROUP BY attacker_ip
ORDER BY hit_count DESC
LIMIT 20;
```

**Step 2: Block Attacker IPs** (if confirmed malicious)
```sql
-- Add to IP blocklist table (create if doesn't exist)
CREATE TABLE IF NOT EXISTS ip_blocklist (
  ip_address INET PRIMARY KEY,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ip_blocklist (ip_address, reason)
VALUES ('123.456.789.012', 'Rate limit attack detected');

-- Update edge function to check blocklist before processing
```

**Step 3: Temporary Rate Limit Reduction**
```typescript
// In edge function, temporarily reduce limits
const RATE_LIMITS = {
  GLOBAL: { limit: 500, window: 60 },   // Reduced from 1000
  IP: { limit: 2, window: 60 },         // Reduced from 5
  EMAIL: { limit: 2, window: 3600 },    // Reduced from 3
};
```

**Step 4: Enable Cloudflare/WAF Protection** (if available)
- Add challenge for cleanup endpoint
- Enable rate limiting at CDN level
- Add CAPTCHA for repeated requests

**Step 5: Monitor and Escalate**
- Continue monitoring attack patterns
- Escalate to security team if attack persists
- File incident report

---

## 5. Email Delivery Troubleshooting

### 5.1 Email Provider Status

**Primary: Resend**
- Status Page: https://status.resend.com
- API Health: `curl https://api.resend.com/health`
- Dashboard: https://resend.com/dashboard

**Fallback: SendGrid**
- Status Page: https://status.sendgrid.com
- API Health: `curl https://api.sendgrid.com/v3/status`
- Dashboard: https://app.sendgrid.com

### 5.2 Investigating Email Delivery Failures

**Query Failed Email Deliveries**:
```sql
SELECT
  correlation_id,
  email_hash,
  error_code,
  error_message,
  created_at
FROM auth_cleanup_log
WHERE error_code = 'ORPHAN_CLEANUP_008'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Check ESP Logs**:
1. Login to Resend Dashboard
2. Navigate to: **Logs**
3. Filter by: `to:user@example.com`
4. Check delivery status: `delivered`, `bounced`, `failed`

**Common Issues**:

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| **Hard Bounce** | Email address invalid/non-existent | No action - user entered wrong email |
| **Soft Bounce** | Mailbox full, temporary failure | Retry after 1 hour |
| **Spam Filter** | Delivered but not in inbox | Check SPF/DKIM/DMARC records |
| **Rate Limited** | ESP returns 429 | Wait and retry, contact ESP support |
| **DNS Issues** | DMARC/SPF lookup failed | Verify DNS records, check propagation |

### 5.3 DNS Record Verification

**SPF Record**:
```bash
dig TXT yourdomain.com | grep spf1

# Expected:
# yourdomain.com. 3600 IN TXT "v=spf1 include:spf.resend.com include:sendgrid.net ~all"
```

**DKIM Records**:
```bash
# Resend
dig TXT resend._domainkey.yourdomain.com

# SendGrid
dig TXT s1._domainkey.yourdomain.com
dig TXT s2._domainkey.yourdomain.com
```

**DMARC Record**:
```bash
dig TXT _dmarc.yourdomain.com

# Expected:
# _dmarc.yourdomain.com. 3600 IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; pct=100"
```

**If Records Missing or Invalid**:
1. Login to DNS provider (Cloudflare, Route53, etc.)
2. Add/update TXT records per [Email Infrastructure Setup](./email-deliverability-setup.md)
3. Wait for propagation (up to 48 hours)
4. Verify with `dig` commands above

### 5.4 Bounce Rate Monitoring

**Acceptable Bounce Rates**:
- **Hard Bounce**: <0.5%
- **Soft Bounce**: <1.0%
- **Total Bounce**: <1.5%

**Query Bounce Rate**:
```sql
-- Requires ESP webhook integration
SELECT
  DATE_TRUNC('day', bounced_at) AS day,
  COUNT(*) AS total_bounces,
  SUM(CASE WHEN bounce_type = 'hard' THEN 1 ELSE 0 END) AS hard_bounces,
  SUM(CASE WHEN bounce_type = 'soft' THEN 1 ELSE 0 END) AS soft_bounces
FROM email_bounces
WHERE bounced_at > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;
```

**If Bounce Rate High (>1.5%)**:
1. Check for spam complaints (users marking as spam)
2. Verify email list hygiene (remove invalid addresses)
3. Check email content for spam triggers
4. Contact ESP support for deliverability review

---

## 6. Performance Optimization

### 6.1 Slow Orphan Detection (p95 > 500ms)

**Step 1: Verify Indexes Exist**
```sql
-- Check indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('companies', 'company_admins')
  AND indexdef LIKE '%admin_uuid%'
ORDER BY tablename, indexname;

-- Expected indexes:
-- companies: idx_companies_owner_admin_uuid
-- company_admins: idx_company_admins_admin_uuid (or PK)
```

**Step 2: Create Missing Indexes**
```sql
-- If indexes missing, create them
CREATE INDEX CONCURRENTLY idx_companies_owner_admin_uuid
  ON companies(owner_admin_uuid);

CREATE INDEX CONCURRENTLY idx_company_admins_admin_uuid
  ON company_admins(admin_uuid);
```

**Step 3: Analyze Query Performance**
```sql
-- Run EXPLAIN ANALYZE on orphan detection queries
EXPLAIN ANALYZE
SELECT id
FROM companies
WHERE owner_admin_uuid = '123e4567-e89b-12d3-a456-426614174000'
LIMIT 1;

-- Expected: "Index Scan" with cost < 10
```

**Step 4: Monitor After Changes**
- Check p95 latency in dashboards
- Verify timeout rate decreased
- Monitor graceful degradation rate

### 6.2 High Graceful Degradation Rate (>5%)

**Causes**:
- Database connection pool exhausted
- Slow queries exceeding 100ms timeout
- Database under heavy load

**Investigation**:
```sql
-- Check active connections
SELECT
  COUNT(*),
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;

-- Check slow queries
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - pg_stat_activity.query_start > interval '100 milliseconds'
ORDER BY duration DESC;
```

**Resolution**:
1. Increase database connection pool size (if exhausted)
2. Optimize slow queries (add indexes, rewrite)
3. Increase timeout from 100ms to 200ms (if queries consistently slow but functional)
4. Scale database instance (if under heavy load)

---

## 7. Common Scenarios

### Scenario 1: User Reports "Code Not Received"

**Triage Questions**:
1. What email address did you use?
2. Have you checked your spam folder?
3. How long ago did you request the code?
4. Have you requested a code before today?

**Investigation Steps**:
```sql
-- Check if code was sent
SELECT
  correlation_id,
  email_hash,
  status,
  error_code,
  created_at
FROM auth_cleanup_log
WHERE email_hash = encode(digest('user@example.com', 'sha256'), 'hex')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Resolution**:
- **Status: pending**: Email sent, check ESP logs for delivery status
- **Status: failed with ORPHAN_CLEANUP_008**: Email failed, resend manually via ESP
- **No record**: User may have used different email, or request failed before logging
- **Code expired**: Request new code (>5 minutes old)

**Manual Resend** (if needed):
1. Copy verification code from `verification_codes` table (decode hash - not possible, must generate new)
2. Actually, cannot retrieve original code (hashed) - user must request new code via UI

**Better Resolution**: Instruct user to:
1. Click "Resend Code" button on recovery form
2. Wait 60 seconds for cooldown
3. Check spam folder again
4. If still not received, escalate to email delivery investigation

### Scenario 2: User Locked Out After Multiple Failed Attempts

**Triage Questions**:
1. How many times did you try entering the code?
2. What error message are you seeing?
3. Are you being rate limited (see "wait X seconds" message)?

**Investigation Steps**:
```sql
-- Check rate limit status for this email
SELECT
  key,
  bucket_time,
  count
FROM rate_limits
WHERE key = 'email:user@example.com'
  AND bucket_time > NOW() - INTERVAL '1 hour'
ORDER BY bucket_time DESC;
```

**Resolution**:
- **Rate limited**: User must wait until rate limit window expires
- **Invalid code**: User may have typo, wrong code, or expired code
- **Code expired**: User must request new code

**Manual Rate Limit Reset** (emergency only, if user confirmed legitimate):
```sql
-- Clear rate limit for email (use with caution)
DELETE FROM rate_limits
WHERE key = 'email:user@example.com';
```

### Scenario 3: Multiple Users Reporting Cleanup Failures

**Indicates**: Systemic issue, not individual user problem

**Investigation Checklist**:
- [ ] Check cleanup success rate in dashboard (is it below 90%?)
- [ ] Query error code distribution (what's the most common error?)
- [ ] Check edge function logs for exceptions
- [ ] Verify database health (connection pool, slow queries)
- [ ] Check ESP status pages (Resend, SendGrid)
- [ ] Verify DNS records (SPF, DKIM, DMARC)
- [ ] Check Vault secret accessibility

**Common Systemic Issues**:

| Issue | Error Code | Resolution |
|-------|------------|------------|
| Database connection pool exhausted | `ORPHAN_CLEANUP_006` | Scale database or increase pool size |
| ESP outage | `ORPHAN_CLEANUP_008` | Wait for ESP recovery, or switch to fallback |
| Vault secret inaccessible | Auth error in logs | Verify Vault secret, redeploy functions |
| Rate limiting too aggressive | `ORPHAN_CLEANUP_003` | Temporarily increase rate limits |

---

## 8. Escalation

### When to Escalate

| Issue | Severity | Escalate To | Timeframe |
|-------|----------|-------------|-----------|
| Orphan detection error rate >10% | Critical | Engineering Lead + PagerDuty | Immediate |
| Cleanup success rate <90% for >30 minutes | Critical | Engineering Lead + PagerDuty | Immediate |
| Global rate limit exhausted >5x in 1 hour | Critical | Security Team + Engineering Lead | Immediate |
| Database connection failures | Critical | Database Admin + Engineering Lead | Immediate |
| Orphan detection p95 >1000ms | High | Engineering Lead | Within 1 hour |
| Email bounce rate >1.5% | Medium | Email Deliverability Specialist | Within 4 hours |
| Unusual orphan patterns (>10x normal) | Medium | Product Team + Engineering Lead | Within 4 hours |

### Escalation Contacts

- **Engineering Lead**: [Slack handle] or [Phone]
- **Database Admin**: [Slack handle] or [Phone]
- **Security Team**: [Slack channel] or [Email]
- **Product Team**: [Slack channel]
- **Supabase Support**: support@supabase.com (Enterprise Plan)

---

## 9. Maintenance Tasks

### Daily Tasks

- [ ] Review dashboards for anomalies
- [ ] Check critical alert status (any incidents overnight?)
- [ ] Review error code distribution (any new patterns?)
- [ ] Monitor email bounce rate (within acceptable range?)

### Weekly Tasks

- [ ] Review orphan detection performance trends (degrading?)
- [ ] Review cleanup success rate trends (declining?)
- [ ] Check for orphaned users older than 7 days (stuck registrations?)
- [ ] Review rate limit hit patterns (abuse attempts?)
- [ ] Clean up old rate limit buckets (>48 hours old)
- [ ] Review auth_cleanup_log size (archive if >100k rows?)

### Monthly Tasks

- [ ] Review and update alert thresholds (false positives? missed issues?)
- [ ] Conduct tabletop exercise for incident response
- [ ] Review and update this runbook (outdated sections?)
- [ ] Check for Supabase platform updates (new features? deprecations?)
- [ ] Review email deliverability metrics (ESP health? DNS changes?)

### Quarterly Tasks

- [ ] Rotate service role key (per security policy)
- [ ] Review and optimize database indexes (performance degradation?)
- [ ] Audit orphan cleanup logs (compliance review)
- [ ] Disaster recovery drill (test rollback procedures)
- [ ] Review rate limit settings (adjust for traffic growth?)

---

## 10. Related Documentation

- [cleanup-orphaned-user API](../api/cleanup-orphaned-user.md) - Edge function API reference
- [check-email-status API](../api/check-email-status.md) - Email status probe API
- [Email Deliverability Setup](./email-deliverability-setup.md) - SPF, DKIM, DMARC configuration
- [Database Migrations](../deployment/database-migrations.md) - Schema reference
- [Rollback Procedures](../deployment/rollback-procedures.md) - Emergency rollback guide
- [Testing Guide](../testing/orphan-cleanup-testing-guide.md) - How to test the system

---

**Document Version**: 1.0
**Last Updated**: 2025-01-28
**Owner**: Engineering Team
**Review Cycle**: Quarterly
