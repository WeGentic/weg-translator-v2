# Requirements Analysis Session - Registration Edge Case Fix

## Current Understanding

Based on the planning documents (UserInput, CodebaseAnalysis, Requirements, and Design), the project aims to enhance the registration and login flows to handle orphaned user accounts. The implementation covers:

- **Case 1.1**: Users with unverified email addresses and no database data
- **Case 1.2**: Users with verified email addresses but no database data
- Cleanup mechanisms using Supabase Edge Functions with service role keys
- Recovery UI with verification code entry
- Enhanced email status probing during registration

The codebase analysis shows partial implementation already exists (orphan detection, email status probe, cleanup edge function structure), and the requirements/design documents provide comprehensive specifications.

## Critical Gaps Identified

After analyzing all documents and conducting research on October 2025 best practices, the following critical gaps and ambiguities were identified:

1. **Deno KV Availability**: The design assumes Deno KV is available for Supabase Edge Functions, which requires verification
2. **Constant-Time Response Implementation**: While specified, the security effectiveness needs validation against 2025 standards
3. **Verification Code Security**: The 6-digit numeric code approach may have security concerns in 2025
4. **Rate Limiting Algorithm**: The sliding window implementation needs alignment with 2025 best practices
5. **React 19.2 Patterns**: Verification that current hooks approach is still optimal
6. **Email Delivery Strategy**: Resend/SendGrid fallback pattern needs validation
7. **Graceful Degradation Policy**: Security implications of allowing vs blocking access on detection failure
8. **Secret Management**: Environment variables vs newer approaches for service role keys

---

## Questions (Priority Order)

### **BLOCKING** (Must answer before proceeding):

**Q1. What is the current status of Deno KV in October 2025 for production use with Supabase Edge Functions?**

**A1.** ⚠️ **CRITICAL FINDING**: Deno KV is **NOT available** for production use with Supabase Edge Functions as of October 2025.

**Key Findings**:
- Supabase Edge Functions do not support or expose Deno KV for managed deployments
- Deno KV is experimental and not production-ready for global, strongly-consistent storage
- The design documents assume Deno KV for verification code storage and distributed locking, **which will not work**

**Recommended Alternatives**:
1. **Supabase Postgres** (RECOMMENDED): Use native database tables for:
   - Verification code storage with TTL via timestamp checks
   - Distributed locking using PostgreSQL advisory locks or row locks
   - Already available, durable, strongly consistent
   - Requires connection pooling consideration for serverless

2. **External Redis** (e.g., Upstash): Accessible via npm modules in Edge Functions
   - Fast, ephemeral storage for codes and locks
   - Supports atomic operations, TTL, distributed consistency
   - Requires additional service dependency

3. **DynamoDB/Firestore**: Global-scale alternatives with strong consistency
   - Higher latency than Redis but better multi-region support
   - Requires HTTP client integration

**Impact on Design**:
- **BLOCKER**: The entire cleanup edge function implementation must be revised
- Verification code storage strategy needs complete redesign
- Distributed locking mechanism must use alternative approach
- All code examples in design document using `Deno.openKv()` are invalid

**Recommendation**: Use **Supabase Postgres** with a new table `verification_codes`:
```sql
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL,
  code_hash BYTEA NOT NULL,
  code_salt BYTEA NOT NULL,
  correlation_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_hash)
);

CREATE INDEX idx_verification_codes_expires_at ON verification_codes(expires_at);
CREATE INDEX idx_verification_codes_email_hash ON verification_codes(email_hash);
```

For distributed locking, use PostgreSQL advisory locks:
```typescript
// Acquire lock
const lockId = hashEmailToInt64(email);
const { data: lockResult } = await supabase.rpc('pg_try_advisory_lock', { key: lockId });

// Release lock
await supabase.rpc('pg_advisory_unlock', { key: lockId });
```

---

**Q2. What are the October 2025 security best practices for storing and handling service role keys in Supabase Edge Functions?**

**A2.** **Supabase Vault** is now the recommended solution (2025), replacing environment variables as the primary method.

**Key Findings**:
1. **Supabase Vault** (RECOMMENDED):
   - Encrypted storage for secrets with fine-grained access controls
   - Audit logging for all secret access
   - Integration with Edge Functions for secure retrieval
   - Preferred over environment variables for production workloads

2. **Environment Variables** (Baseline):
   - Still supported but considered baseline, not best-in-class
   - Lack encryption at rest, weak access controls, no audit trails
   - Acceptable for development but not recommended for production service role keys

3. **Deno KV Secrets**: Not sufficient alone for highly sensitive keys
   - Must be combined with Vault and encryption for defense-in-depth

**Best Practices**:
- Use Supabase Vault for service role key storage
- Apply MFA and role-based access controls to secret management interfaces
- Scan code pre-deployment for leaked secrets
- Do NOT make Vault accessible to end-user roles or unnecessary functions
- Combine with Row-Level Security (RLS) for layered defense

**Impact on Design**:
- Edge function initialization should retrieve service role key from Vault, not `Deno.env.get()`
- Add Vault setup documentation to deployment procedures
- Update security requirements to mandate Vault usage

**Example**:
```typescript
// Old approach (still works but not recommended)
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// New approach (recommended)
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  // Service role key should be fetched from Vault
  await getSecretFromVault('SUPABASE_SERVICE_ROLE_KEY')
);
```

---

**Q3. What are the October 2025 best practices for graceful degradation when orphan detection queries timeout in authentication flows?**

**A3.** **Block access** when detection fails - fail-closed, not fail-open.

**Key Findings**:
- **Default behavior must be to BLOCK access** if orphan detection cannot complete
- Allowing access without verification (fail-open) creates security vulnerabilities:
  - Attackers can exploit transient failures or resource exhaustion
  - Orphaned accounts could gain unauthorized access
  - Defeats the entire purpose of orphan detection

**Security Implications**:
- **Fail-open risks**: Privilege escalation, stale account exploitation, lateral movement
- **Fail-closed approach**: May inconvenience legitimate users but prevents unauthorized access
- Fail-closed is the industry-standard secure default for 2025 authentication flows

**Recommended Approach**:
1. Set realistic timeout values (500ms is appropriate)
2. Implement retry logic (2-3 attempts with exponential backoff)
3. If all attempts fail, BLOCK login and show clear error message
4. Log all timeout events for monitoring and alerting
5. Provide user-facing guidance: "Authentication system is temporarily unavailable. Please try again in a few minutes."

**Impact on Design**:
- **CRITICAL CHANGE**: The design document states "graceful degradation: allow login to proceed with orphanCheckFailed flag"
- This is **INCORRECT** for security in 2025
- Must be changed to: "If orphan detection times out after all retries, BLOCK login and display temporary service error"

**Updated Flow**:
```typescript
try {
  const orphanResult = await checkIfOrphaned(userId, { maxRetries: 3 });

  if (orphanResult.isOrphaned) {
    // Handle orphan case
  }

  // Allow login
} catch (error) {
  if (error.name === 'TimeoutError' || error.name === 'OrphanCheckFailed') {
    // BLOCK ACCESS - do not proceed with login
    await supabase.auth.signOut();

    throw new Error(
      'Authentication system is temporarily unavailable. Please try again in a few minutes. ' +
      'If this persists, contact support.'
    );
  }

  throw error;
}
```

---

### **HIGH** (Strongly impacts design):

**Q4. What are the October 2025 best practices for email verification codes in authentication flows?**

**A4.** 6-digit numeric codes are **minimum acceptable** for low-risk flows; **8-10 character alphanumeric codes** are recommended for account recovery.

**Key Findings**:
1. **6-digit numeric codes** (1 million combinations):
   - Still widely used but considered minimal security level
   - Acceptable only for basic sign-up, low-risk verification
   - **Insufficient** for account recovery or password reset flows

2. **8-10 character alphanumeric codes** (RECOMMENDED for recovery):
   - Mix of uppercase, lowercase, numbers
   - Avoid ambiguous characters (O/0, l/1)
   - Significantly higher entropy (~2.8 trillion for 8 chars)
   - Industry standard for 2025 account recovery scenarios

3. **Stronger Alternatives**:
   - **Magic Links**: Single-use URLs, expires in 5-10 minutes (good UX)
   - **TOTP**: Time-based codes from authenticator app (highest security)
   - **WebAuthn**: Hardware-backed (future-proof but limited adoption)

**Recommended Parameters**:
| Use Case | Code Format | Length | Expiry | Attempts |
|----------|-------------|--------|--------|----------|
| Basic signup | Numeric | 6 digits | 10 min | 5 |
| Account recovery | Alphanumeric | 8-10 chars | 5 min | 3 |
| High-security | TOTP/Magic Link | N/A | 2-5 min | 3 |

**Impact on Design**:
- Current design uses 6-digit codes, which is **marginal** for orphan cleanup (account recovery scenario)
- **RECOMMEND**: Upgrade to **8-character alphanumeric** for cleanup verification codes
- Reduce expiry from 10 minutes to **5 minutes** for recovery flow
- Limit attempts to **3 per code** before requiring resend
- Consider adding magic link as alternative recovery method

**Example**:
```typescript
// Updated code generation (8-char alphanumeric)
function generateSecureCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ambiguous chars removed
  const length = 8;
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }

  return code;
}
```

---

**Q5. What are the current best practices for constant-time response patterns in October 2025 to prevent timing attacks?**

**A5.** Modern approaches go **beyond basic constant-time comparison** to include statistical noise injection, adaptive delays, and ML-based anomaly detection.

**Key Findings**:
1. **Constant-Time Cryptographic Operations** (Baseline):
   - Still essential foundation
   - Use constant-time comparison for all secret validation
   - But **insufficient alone** for 2025 distributed systems

2. **Statistical Noise Injection** (NEW - Recommended):
   - Add **randomized, statistically-controlled delays** to responses
   - Not just uniform delays - use calibrated noise distributions
   - Makes timing patterns harder to analyze at scale
   - Example: jitter = (Math.random() * 2 - 1) * 50 + Gaussian(mean=0, stddev=25)

3. **Adaptive Response Delays** (Advanced):
   - Adjust delay based on real-time risk scoring
   - High-risk requests get additional latency or fake failure modes
   - Prevents attackers from inferring valid codes by response time

4. **ML-Based Anomaly Detection**:
   - Deploy ML models at edge to detect timing attack patterns
   - Automated detection of time-differential probing
   - Enable early blocking before attack yields data

**Current Design Assessment**:
- Design uses basic constant-time comparison ✓
- Design uses fixed target time (500ms) with jitter ✓
- **Missing**: Statistical noise should be more sophisticated
- **Missing**: No anomaly detection or adaptive delays

**Recommendations**:
1. Keep constant-time comparison and base delay (required)
2. **Enhance jitter** to use better statistical distribution:
```typescript
// Current (acceptable)
const jitter = (Math.random() * 2 - 1) * 50;

// Better (recommended for 2025)
function gaussianJitter(mean: number, stddev: number): number {
  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

const jitter = gaussianJitter(0, 25); // Mean=0, stddev=25ms
```

3. **Add request fingerprinting** and rate-limit repeated validation attempts from same IP/session
4. **Log timing metrics** for offline analysis of potential attack patterns
5. Consider adding adaptive delays for requests flagged as suspicious

**Impact on Design**:
- Core approach is sound, but jitter calculation should be enhanced
- Add request fingerprinting to cleanup edge function
- Implement tighter rate limiting on validation attempts (currently 3 per email per hour - consider 3 per IP per hour as well)

---

**Q6. What are the recommended patterns for sliding window rate limiting with atomic operations in October 2025?**

**A6.** **Bucketed sliding window** with atomic increments in distributed KV stores remains the gold standard.

**Key Findings**:
1. **Bucketed Sliding Window Algorithm** (Recommended):
   - Divide window into fixed buckets (1s or 10s intervals)
   - Store counter per bucket per key
   - Compute weighted sum of buckets overlapping window
   - Balance between accuracy and resource usage

2. **Atomic Operations**:
   - Use atomic increment (INCR/atomic upsert) per bucket
   - Prevents race conditions in concurrent requests
   - Essential for strong consistency

3. **Edge Case Handling**:
   - **Clock Skew**: Use centralized store's clock or NTP sync; tolerate limited skew conservatively
   - **Concurrent Requests**: Atomic ops prevent lost updates; consider sharding for high contention
   - **Retry-After**: Calculate from timestamp of earliest bucket contributing to limit

4. **Implementation Details**:
   - Use TTL on bucket keys to auto-cleanup (window duration × 2)
   - For high throughput: shard counters, pipeline operations
   - No single Deno-KV library exists, but pattern is well-established

**Current Design Assessment**:
- Design mentions sliding window with Deno KV atomic operations
- Since Deno KV is unavailable (Q1), implementation must use alternative

**Recommended Implementation** (using Postgres):
```sql
-- Create rate limit tracking table
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  bucket_time TIMESTAMPTZ NOT NULL,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (key, bucket_time)
);

CREATE INDEX idx_rate_limits_bucket_time ON rate_limits(bucket_time);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, retry_after INTEGER) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_bucket_time TIMESTAMPTZ;
  v_oldest_bucket TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  v_bucket_time := DATE_TRUNC('second', NOW());

  -- Get current count in window
  SELECT COALESCE(SUM(count), 0) INTO v_current_count
  FROM rate_limits
  WHERE key = p_key AND bucket_time > v_window_start;

  -- Clean old buckets
  DELETE FROM rate_limits
  WHERE bucket_time <= v_window_start - (p_window_seconds || ' seconds')::INTERVAL;

  IF v_current_count >= p_limit THEN
    -- Find oldest bucket to calculate retry-after
    SELECT MIN(bucket_time) INTO v_oldest_bucket
    FROM rate_limits
    WHERE key = p_key AND bucket_time > v_window_start;

    RETURN QUERY SELECT FALSE, v_current_count,
      EXTRACT(EPOCH FROM (v_oldest_bucket + (p_window_seconds || ' seconds')::INTERVAL - NOW()))::INTEGER;
  ELSE
    -- Increment current bucket
    INSERT INTO rate_limits (key, bucket_time, count)
    VALUES (p_key, v_bucket_time, 1)
    ON CONFLICT (key, bucket_time) DO UPDATE SET count = rate_limits.count + 1;

    RETURN QUERY SELECT TRUE, v_current_count + 1, 0;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Impact on Design**:
- Rate limiting implementation must be completely rewritten for Postgres
- Add rate_limits table to database schema
- Update edge function to call Postgres function instead of Deno KV
- Consider Redis (Upstash) as alternative for better latency

---

**Q7. What are the October 2025 best practices for email delivery reliability in critical authentication flows?**

**A7.** Multi-provider failover, strict authentication (SPF/DKIM/DMARC), and comprehensive monitoring are essential for >99% delivery.

**Key Findings**:
1. **Mandatory Authentication** (2025 Requirement):
   - **SPF, DKIM, DMARC** must be properly configured
   - Gmail/Yahoo mandate this; missing = filtering/blocking
   - Start with DMARC "p=none" (monitor), then move to "p=quarantine" or "p=reject"
   - Use dedicated subdomain for auth emails (auth.example.com)

2. **Recommended Email Service Providers**:
   - **Mailgun**: Strong deliverability, transparent reporting
   - **Braze**: Enterprise-grade reliability
   - **SparkPost**: Advanced monitoring capabilities
   - **Postmark**: Excellent for transactional email, simple API
   - **Resend**: Modern API, good documentation
   - Design uses Resend → SendGrid fallback, which is acceptable

3. **Retry Strategy**:
   - Retry immediately on soft failures (mailbox full, temp errors)
   - Use exponential backoff: 1, 5, 15, 30 minutes
   - **Do not** endlessly retry (damages reputation)
   - After 3 attempts over 1 hour, mark as failed

4. **Multi-Provider Failover**:
   - If primary ESP fails after X attempts, route via secondary ESP
   - Both ESPs must have proper authentication configured
   - Essential for >99% reliability during provider outages

5. **Monitoring Requirements**:
   - Track: bounce rates (<0.3%), spam complaints (<0.1%), delivery time
   - Real-time alerts for: bounce surges, blocklist events, engagement drops
   - Use ESP dashboards + external tools (250ok, GlockApps, Talos)

6. **Best Practices**:
   - Use **transactional email streams** (not bulk marketing)
   - Send from dedicated subdomain with strict auth settings
   - Immediate list hygiene: remove bounced/complained addresses
   - No promotional content in verification emails

**Current Design Assessment**:
- Design includes Resend → SendGrid fallback ✓
- Design includes retry logic with exponential backoff ✓
- **Missing**: SPF/DKIM/DMARC setup documentation
- **Missing**: Monitoring and alerting strategy
- **Missing**: List hygiene procedures

**Recommendations**:
1. **Add to deployment docs**: SPF/DKIM/DMARC configuration steps
2. **Enhance retry logic**: Implement exactly as described (1, 5, 15, 30 min intervals, max 3 attempts)
3. **Add monitoring**: Set up alerts for bounce rates >0.5%, delivery time >30s
4. **Email templates**: Ensure plain text + HTML versions, no promotional content
5. **Dedicated subdomain**: Use auth.yourdomain.com for all verification emails
6. **Bounce handling**: Implement webhook to capture bounces and auto-cleanup invalid addresses

**Example DNS Records**:
```
; SPF record
@ IN TXT "v=spf1 include:_spf.google.com include:spf.resend.com include:sendgrid.net ~all"

; DKIM records (provided by ESPs)
resend._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3..."
sendgrid._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3..."

; DMARC record
_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; pct=100"
```

---

### **MEDIUM** (Affects implementation details):

**Q8. What are the current React 19.2 (October 2025) best practices for implementing debounced API calls with AbortController?**

**A8.** The **traditional useEffect + debounce + AbortController pattern remains the standard** - no new built-in hooks replace it.

**Key Findings**:
1. **No New React Hook**: React 19.2 does not introduce built-in debounce or abort/cancellation hooks
2. **Recommended Pattern** (Still Valid):
   - Debounce callback using custom hook or useCallback + debounce utility
   - Use AbortController for request cancellation
   - Manual cleanup on unmount

3. **Best Practices**:
   - Create custom `useDebouncedCallback` hook for reusability
   - Pass values as arguments, not via closure (avoid stale values)
   - Always cleanup timeouts and abort controllers on unmount
   - Handle errors gracefully (check for AbortError)

**Current Design Assessment**:
- Design uses traditional pattern with useEffect + debounce ✓
- Design includes AbortController ✓
- Pattern is **correct and current** for October 2025

**No Changes Required** - Current approach is optimal.

**Example (for reference)**:
```typescript
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

// Usage in email probe
const probeEmail = useDebouncedCallback((email: string) => {
  const controller = new AbortController();

  fetch(`/api/email-status?email=${email}`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setResult(data))
    .catch(err => {
      if (err.name === 'AbortError') return;
      setError(err);
    });

  return () => controller.abort();
}, 450);
```

---

## Summary of Critical Findings

### **BLOCKING ISSUES** (Must be resolved):

1. ⛔ **Deno KV Not Available**: Entire verification code storage and distributed locking design is invalid
   - **Solution**: Migrate to Supabase Postgres with new `verification_codes` table and PostgreSQL advisory locks
   - **Impact**: High - requires complete rewrite of cleanup edge function storage layer

2. ⚠️ **Fail-Open Security Issue**: Design allows login on orphan detection failure (fail-open)
   - **Solution**: Change to fail-closed - BLOCK access when detection fails
   - **Impact**: Medium - requires AuthProvider.login() logic change and user messaging

3. 🔐 **Service Role Key Storage**: Environment variables are outdated
   - **Solution**: Migrate to Supabase Vault for encrypted secret storage
   - **Impact**: Medium - requires Vault setup and edge function refactoring

### **HIGH PRIORITY** (Strongly recommended):

4. 🔢 **Verification Code Weakness**: 6-digit codes are minimal for account recovery
   - **Solution**: Upgrade to 8-character alphanumeric codes, reduce expiry to 5 minutes
   - **Impact**: Low - straightforward code change

5. ⏱️ **Enhanced Constant-Time Response**: Basic jitter should be improved
   - **Solution**: Use Gaussian distribution for jitter, add request fingerprinting
   - **Impact**: Low - enhance existing constant-time function

6. 📊 **Rate Limiting Implementation**: Needs Postgres-based solution
   - **Solution**: Implement bucketed sliding window using Postgres functions
   - **Impact**: Medium - new table and stored procedures required

7. 📧 **Email Deliverability**: Missing SPF/DKIM/DMARC documentation
   - **Solution**: Add DNS configuration docs, monitoring setup, bounce handling
   - **Impact**: Low - documentation and monitoring addition

### **VALIDATED** (No changes needed):

8. ✅ **React 19.2 Patterns**: Current debounce + AbortController approach is correct and current
   - **Impact**: None - no changes required

---

## Recommendations for Project Continuation

### **Phase 0 - Critical Design Revisions** (NEW - Must complete before implementation):

1. **Revise Storage Architecture**:
   - Remove all Deno KV references from design
   - Design Postgres-based verification code storage
   - Design Postgres advisory lock pattern for distributed locking
   - Update all code examples in design document

2. **Revise Security Policies**:
   - Change graceful degradation to fail-closed (block access on detection failure)
   - Update orphan detection error handling in AuthProvider
   - Document user-facing error messages for service unavailability

3. **Upgrade Verification Code Security**:
   - Change from 6-digit numeric to 8-character alphanumeric
   - Reduce expiry from 10 minutes to 5 minutes
   - Limit validation attempts to 3 per code

4. **Update Secret Management**:
   - Document Supabase Vault setup procedures
   - Revise edge function initialization to use Vault
   - Add security scanning to CI/CD pipeline

### **Implementation Adjustments**:

5. **Database Schema Updates**:
   - Add `verification_codes` table (replaces Deno KV)
   - Add `rate_limits` table (replaces Deno KV)
   - Create PostgreSQL functions for rate limiting
   - Create functions for advisory lock management

6. **Email Infrastructure**:
   - Document SPF/DKIM/DMARC setup
   - Implement bounce webhook handling
   - Set up monitoring dashboards (bounce rates, delivery time)
   - Configure dedicated subdomain (auth.yourdomain.com)

7. **Enhanced Security**:
   - Improve jitter calculation (Gaussian distribution)
   - Add request fingerprinting to edge functions
   - Implement stricter per-IP rate limiting
   - Add logging for timing attack detection

### **Testing Requirements**:

8. **Additional Test Scenarios**:
   - Test orphan detection timeout with fail-closed behavior
   - Test Postgres-based verification code storage with TTL
   - Test PostgreSQL advisory lock acquisition/release
   - Test multi-provider email failover
   - Test 8-character alphanumeric code validation
   - Test rate limiting with Postgres bucketed window

---

## Conclusion

The original planning documents provide a solid foundation, but critical issues were identified through October 2025 best practices research:

1. **Deno KV unavailability** requires complete storage architecture redesign
2. **Security policy** must change from fail-open to fail-closed
3. **Verification code strength** should be increased for account recovery scenario
4. **Secret management** should migrate to Supabase Vault
5. **Email deliverability** requires additional infrastructure documentation

All other aspects (React patterns, constant-time responses, rate limiting algorithms) are fundamentally sound and require only minor enhancements or no changes.

**Recommendation**: Complete Phase 0 design revisions before proceeding to implementation to avoid costly refactoring during development.
