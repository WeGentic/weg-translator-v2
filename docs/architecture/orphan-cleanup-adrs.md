# Architecture Decision Records - Orphan Cleanup System

## ADR-001: Use Postgres Instead of Deno KV for Verification Code Storage

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team

### Context

Original design specified Deno KV for storing verification codes with automatic TTL expiry. However, Deno KV is not available in the current Supabase hosting environment.

### Decision

Use PostgreSQL tables with application-level TTL logic for verification code storage.

**Implementation**:
- Table: `verification_codes` with `expires_at` timestamp column
- Cleanup via `WHERE expires_at < NOW()` check during validation
- Optional: Scheduled job for periodic cleanup of expired codes

### Consequences

**Positive**:
- ✅ Works with existing PostgreSQL infrastructure
- ✅ No additional service dependencies
- ✅ Leverages existing database connection pool
- ✅ ACID guarantees for all operations
- ✅ Easier to query and audit

**Negative**:
- ⚠️ Requires manual cleanup of expired codes (vs automatic TTL)
- ⚠️ Slightly more complex query logic
- ⚠️ Must handle expiry in application code

**Mitigations**:
- Implement efficient cleanup during validation (no stale data impact)
- Add periodic cleanup job if table grows large
- Index on `expires_at` for efficient cleanup queries

---

## ADR-002: Fail-Closed Policy for Orphan Detection

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team, Security Team

### Context

Original design used fail-open graceful degradation: if orphan detection timed out or errored, login would proceed with a flag set. This created a security concern where orphaned users could potentially access the system during detection failures.

### Decision

Implement fail-closed policy: if orphan detection fails after all retry attempts, block login with service error message.

**Implementation**:
- 3 retry attempts with exponential backoff (immediate, +200ms, +500ms)
- Total maximum time: ~2.2 seconds
- If all retries fail: throw error, block login
- Error message: "Authentication system is temporarily unavailable. Please try again in a few minutes."

### Consequences

**Positive**:
- ✅ More secure: prevents orphaned users from accessing system during detection failures
- ✅ Incentivizes fixing detection performance issues
- ✅ Clear signal when system is degraded

**Negative**:
- ⚠️ Legitimate users blocked during system issues
- ⚠️ Higher operational burden (must fix issues quickly)
- ⚠️ Potential user frustration during outages

**Mitigations**:
- Aggressive retry logic (3 attempts) gives multiple chances to succeed
- Clear error message instructs users to retry
- Monitoring alerts on high error rates for quick response
- Database performance optimization to minimize failures

---

## ADR-003: 8-Character Alphanumeric Codes with Ambiguity-Free Alphabet

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team, Security Team

### Context

Original design used 6-digit numeric codes (1 million combinations). UserQA analysis identified this as insufficient entropy for a 5-minute window.

### Decision

Use 8-character alphanumeric codes with ambiguity-free alphabet:
- Characters: `A-Z` except `O` (confused with 0), `2-9` except `0,1` (ambiguous)
- Alphabet size: 32 characters (25 letters + 7 digits)
- Total combinations: 32^8 = 1.1 trillion
- Format: `XXXX-XXXX` (hyphen for readability)
- Expiry: 5 minutes (reduced from 10)

### Consequences

**Positive**:
- ✅ Massively increased entropy: 1M → 1.1T combinations
- ✅ No ambiguous characters (O/0, I/1, etc.)
- ✅ Case-insensitive validation reduces user errors
- ✅ Hyphen improves readability and reduces typos

**Negative**:
- ⚠️ Longer code to enter (8 vs 6 characters)
- ⚠️ Requires more complex generation logic

**Mitigations**:
- Hyphen auto-formatted in UI to improve readability
- Client-side validation provides immediate feedback
- Case-insensitive comparison reduces friction

---

## ADR-004: Gaussian Jitter for Constant-Time Responses

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team, Security Team

### Context

Original design used uniform random jitter (±50ms) for constant-time responses. This creates a predictable distribution that could potentially be analyzed by sophisticated attackers.

### Decision

Use Gaussian (normal) distribution jitter with Box-Muller transform:
- Mean: 0ms
- Standard deviation: 25ms
- ~95% of values within ±50ms (2σ)
- Natural noise pattern harder to analyze

### Consequences

**Positive**:
- ✅ More natural timing distribution
- ✅ Harder for attackers to identify patterns
- ✅ Statistically more defensive against timing attacks

**Negative**:
- ⚠️ Slightly more complex implementation (Box-Muller transform)

**Mitigations**:
- Implementation is straightforward with Math functions
- Performance impact negligible

---

## ADR-005: PostgreSQL Advisory Locks for Distributed Locking

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team

### Context

Original design used Deno KV atomic operations for distributed locking. With Postgres-based storage, need alternative distributed locking mechanism.

### Decision

Use PostgreSQL advisory locks for distributed concurrency control:
- Function: `pg_try_advisory_lock(bigint)`
- Lock ID: Hash email to 64-bit integer
- Release: `pg_advisory_unlock(bigint)` in finally block
- Application-level 30-second timeout

### Consequences

**Positive**:
- ✅ Native Postgres feature (no additional dependencies)
- ✅ Automatic cleanup on connection close
- ✅ Fast lock acquisition (no disk I/O)
- ✅ Works across edge function instances

**Negative**:
- ⚠️ Advisory locks don't enforce data access (application must respect them)
- ⚠️ Must ensure always released (use finally blocks)

**Mitigations**:
- Consistent lock acquisition pattern in all code paths
- Always use try/finally for lock release
- Application-level timeout prevents orphaned locks
- Advisory locks auto-release on connection close

---

## ADR-006: Supabase Vault for Service Role Key Storage

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team, Security Team

### Context

Original design used environment variables for service role key storage. This is less secure and harder to rotate.

### Decision

Use Supabase Vault for secure service role key storage:
- Secret name: `SUPABASE_SERVICE_ROLE_KEY`
- Access: Edge functions only
- Retrieval: Built-in Supabase secret injection or Vault SDK
- Rotation: Update Vault secret → redeploy functions (zero downtime)

### Consequences

**Positive**:
- ✅ Encrypted at rest in Vault
- ✅ Audit trail for secret access
- ✅ Easy rotation without code changes
- ✅ Access controls (edge functions only)
- ✅ No secrets in code or environment variables

**Negative**:
- ⚠️ Requires Vault setup in Supabase Dashboard
- ⚠️ Local development requires fallback (Deno.env.get with warning)

**Mitigations**:
- Document Vault setup procedure
- Provide development environment fallback
- Add warning log when using environment variable in dev

---

## ADR-007: Dual Email Provider with Automatic Fallback

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team

### Context

Email delivery is critical for orphan cleanup flow. Single email provider creates single point of failure.

### Decision

Implement dual email provider strategy:
- **Primary**: Resend (modern, developer-friendly)
- **Fallback**: SendGrid (established, reliable)
- **Retry Logic**: 3 attempts per provider (immediate, +1s, +2s)
- **Fallback Trigger**: After all Resend attempts fail

### Consequences

**Positive**:
- ✅ Higher email delivery reliability
- ✅ Resilience to provider outages
- ✅ No single point of failure

**Negative**:
- ⚠️ Requires configuring two ESPs
- ⚠️ Higher cost (two provider accounts)
- ⚠️ More complex email send logic

**Mitigations**:
- Cost acceptable for critical flow
- Complexity encapsulated in email utility function
- Monitoring tracks which provider is used

---

## ADR-008: Parallel Queries with Individual Error Handling for Orphan Detection

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team

### Context

Orphan detection requires querying two tables (`companies` and `company_admins`). Sequential queries would double the latency.

### Decision

Execute queries in parallel using `Promise.all()`:
- Query both tables simultaneously
- Individual error handling for each query
- Combined timeout for both queries (500ms)
- If either query fails: retry entire detection (fail-closed)

### Consequences

**Positive**:
- ✅ ~50% latency reduction (parallel vs sequential)
- ✅ Meets p95 performance target (<200ms)
- ✅ Individual error visibility

**Negative**:
- ⚠️ Slightly more complex error handling
- ⚠️ If one query fails, both are retried

**Mitigations**:
- Clear error handling logic
- Logging identifies which query failed
- Retry logic gives multiple chances

---

## ADR-009: 5-Minute Verification Code TTL

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team, UX Team

### Context

Original design used 10-minute TTL. UserQA recommended shorter TTL for better security.

### Decision

Reduce verification code TTL to 5 minutes:
- Stored in database: `expires_at = NOW() + INTERVAL '5 minutes'`
- Validation checks: `WHERE expires_at > NOW()`
- User experience: Prominent "Resend Code" button with 60-second cooldown

### Consequences

**Positive**:
- ✅ Reduced exposure window for codes
- ✅ Lower risk if email compromised
- ✅ Encourages timely completion

**Negative**:
- ⚠️ Users must act within 5 minutes
- ⚠️ Potential frustration if code expires

**Mitigations**:
- Clear expiry time shown in UI ("Expires in 4:32")
- Easy resend button (60-second cooldown)
- Email includes expiry time
- Error message for expired code guides to resend

---

## ADR-010: Hash-Based Storage with Constant-Time Comparison

**Status**: Accepted
**Date**: 2025-01-28
**Decision Makers**: Engineering Team, Security Team

### Context

Verification codes must be stored securely to protect against database compromise.

### Decision

Store codes as SHA-256 hashes with random salts:
- **Generation**: `code = generateSecureCode()` (8-char alphanumeric)
- **Storage**: `hash = SHA256(code + salt)`, store `{ hash, salt }`, never plaintext
- **Validation**: Recreate `hash = SHA256(submitted_code + stored_salt)`, constant-time compare
- **Comparison**: Byte-by-byte comparison without short-circuit

### Consequences

**Positive**:
- ✅ Codes unrecoverable from database (even with access)
- ✅ Each code has unique salt (no rainbow tables)
- ✅ Constant-time comparison prevents timing attacks

**Negative**:
- ⚠️ Cannot retrieve original code (must generate new if needed)
- ⚠️ More complex validation logic

**Mitigations**:
- Expected behavior: users receive code via email
- If code lost, user requests new one (resend button)
- Complexity encapsulated in utility functions

---

## Summary Matrix

| ADR | Decision | Primary Driver | Impact Level |
|-----|----------|----------------|--------------|
| ADR-001 | Postgres instead of Deno KV | Technical Constraint | High (architecture) |
| ADR-002 | Fail-closed policy | Security | High (behavior) |
| ADR-003 | 8-char alphanumeric codes | Security | Medium (UX + security) |
| ADR-004 | Gaussian jitter | Security | Low (implementation) |
| ADR-005 | PostgreSQL advisory locks | Technical Constraint | Medium (architecture) |
| ADR-006 | Supabase Vault | Security | Medium (operations) |
| ADR-007 | Dual email providers | Reliability | Medium (operations) |
| ADR-008 | Parallel queries | Performance | High (performance) |
| ADR-009 | 5-minute TTL | Security | Low (UX) |
| ADR-010 | Hash-based storage | Security | Medium (security) |

---

**Document Version**: 1.0
**Last Updated**: 2025-01-28
**Review Cycle**: As needed for architectural changes
