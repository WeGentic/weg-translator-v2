# Code Review & Security Audit Checklist - Orphan Cleanup System

## Overview

This checklist provides a comprehensive code review and security audit framework for the orphaned user detection and cleanup system. Use this before final deployment to production.

**Reviewers**: Minimum 2 engineers (1 security-focused)
**Estimated Time**: 2-4 hours
**Prerequisites**: All Phase 0-5 implementation complete

---

## 1. Security Review

### 1.1 Authentication & Authorization

- [ ] **Service Role Key Storage**
  - [ ] Service role key stored in Supabase Vault (not environment variables)
  - [ ] Vault access restricted to edge functions only
  - [ ] No service role key hardcoded in codebase
  - [ ] Local development uses separate key with warning log
  - [ ] Key rotation procedure documented and tested

- [ ] **No Authentication Required for Cleanup**
  - [ ] cleanup-orphaned-user edge function operates without user session
  - [ ] Service role client created with `auth: { persistSession: false }`
  - [ ] Email verification (code) serves as authentication
  - [ ] Orphan status re-verified before deletion

- [ ] **Authorization Checks**
  - [ ] Only orphaned users can be deleted (no company data check)
  - [ ] Distributed locks prevent concurrent operations
  - [ ] Rate limiting prevents abuse

### 1.2 Verification Code Security

- [ ] **Code Generation**
  - [ ] Uses cryptographically secure random number generator (crypto.getRandomValues)
  - [ ] 8-character alphanumeric codes (1.1 trillion combinations)
  - [ ] Ambiguity-free alphabet (no O/0, I/1 confusion)
  - [ ] No predictable patterns in code generation

- [ ] **Hash-Based Storage**
  - [ ] Codes never stored in plaintext
  - [ ] SHA-256 hashing with random 16-byte salts
  - [ ] Each code has unique salt (no rainbow table attacks)
  - [ ] Codes cannot be retrieved from database (only validated)

- [ ] **Constant-Time Validation**
  - [ ] Comparison uses byte-by-byte constant-time function
  - [ ] No short-circuit on first mismatch
  - [ ] Prevents timing attacks on code validity
  - [ ] Tested with multiple invalid codes (timing variance <10ms)

- [ ] **Expiry and TTL**
  - [ ] Codes expire after 5 minutes (300 seconds)
  - [ ] Expiry enforced via `expires_at < NOW()` check
  - [ ] Expired codes return ORPHAN_CLEANUP_001 error
  - [ ] Periodic cleanup of expired codes (cron job or on-validation)

### 1.3 Timing Attack Prevention

- [ ] **Constant-Time Response**
  - [ ] All response paths target 500ms ±50ms
  - [ ] Gaussian jitter applied (Box-Muller transform)
  - [ ] Applied to: success, error, validation failure, rate limit
  - [ ] Tested with multiple scenarios (variance <100ms)

- [ ] **No Information Leakage**
  - [ ] Email existence not revealed through timing
  - [ ] Code validity not revealed through timing
  - [ ] Orphan status not revealed through timing
  - [ ] All error paths take same time

### 1.4 Rate Limiting

- [ ] **Three-Tier Rate Limiting**
  - [ ] Global: 1000 requests/60s (protect backend)
  - [ ] Per-IP: 5 requests/60s (prevent single-source abuse)
  - [ ] Per-Email: 3 requests/60min (prevent targeted attacks)

- [ ] **PostgreSQL-Based Implementation**
  - [ ] Sliding window algorithm with 1-second buckets
  - [ ] Atomic operations (no race conditions)
  - [ ] Efficient index on `bucket_time`
  - [ ] Periodic cleanup of old buckets

- [ ] **Rate Limit Headers**
  - [ ] X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  - [ ] Retry-After header on 429 responses
  - [ ] Clear error messages with retry guidance

### 1.5 Input Validation

- [ ] **Zod Schema Validation**
  - [ ] Email: Valid format, max 255 chars, lowercase/trim transform
  - [ ] Verification code: Exactly 8 chars, alphanumeric, hyphen allowed
  - [ ] Correlation ID: Valid UUID v4 format
  - [ ] Step: Literal "request-code" or "validate-and-cleanup"

- [ ] **SQL Injection Prevention**
  - [ ] All queries use parameterized statements
  - [ ] No string concatenation for queries
  - [ ] User input never directly in SQL

- [ ] **XSS Prevention**
  - [ ] All user input sanitized before display
  - [ ] React escapes by default
  - [ ] No dangerouslySetInnerHTML with user content

### 1.6 Data Privacy

- [ ] **PII Hashing in Logs**
  - [ ] Email addresses hashed (SHA-256) before logging
  - [ ] IP addresses hashed before storage
  - [ ] Verification codes never logged (plain or hashed)
  - [ ] Correlation IDs used for tracing (not PII)

- [ ] **GDPR Compliance**
  - [ ] Users can delete orphaned accounts without authentication
  - [ ] Audit trail in auth_cleanup_log (with hashed PII)
  - [ ] No unnecessary data retention
  - [ ] Periodic cleanup of old logs (documented)

### 1.7 Distributed Locking

- [ ] **PostgreSQL Advisory Locks**
  - [ ] Lock acquired before cleanup operations
  - [ ] Lock ID derived from email hash (consistent)
  - [ ] Lock always released in finally block
  - [ ] 30-second application timeout prevents deadlocks
  - [ ] Returns 409 Conflict if lock already held

- [ ] **Race Condition Prevention**
  - [ ] Re-verify orphan status after lock acquisition
  - [ ] Handle case where user completes registration between steps
  - [ ] Return ORPHAN_CLEANUP_005 if no longer orphaned

---

## 2. Code Quality Review

### 2.1 TypeScript / React Frontend

- [ ] **Type Safety**
  - [ ] No `any` types (except documented exceptions)
  - [ ] All props properly typed
  - [ ] All API responses validated with Zod
  - [ ] Union types for discriminated unions (step: "request-code" | "validate-and-cleanup")

- [ ] **React 19 Best Practices**
  - [ ] No manual useMemo/useCallback unless profiled
  - [ ] Proper use of useTransition for non-urgent updates
  - [ ] Suspense boundaries for async components
  - [ ] Error boundaries for recovery flows

- [ ] **Error Handling**
  - [ ] All async operations wrapped in try/catch
  - [ ] User-friendly error messages
  - [ ] Errors logged with correlation IDs
  - [ ] AbortController for request cancellation

- [ ] **Accessibility**
  - [ ] role="alert" for errors
  - [ ] aria-live="polite" for status updates
  - [ ] Keyboard navigation support
  - [ ] Screen reader friendly messages

### 2.2 Deno / Edge Functions (TypeScript)

- [ ] **Error Handling**
  - [ ] All errors caught and returned as structured JSON
  - [ ] No unhandled promise rejections
  - [ ] try/catch/finally for all operations
  - [ ] Locks always released (finally blocks)

- [ ] **Logging**
  - [ ] Structured JSON logging
  - [ ] Correlation IDs in all logs
  - [ ] PII hashed before logging
  - [ ] Log levels appropriate (info, warn, error)

- [ ] **Performance**
  - [ ] Parallel queries where possible
  - [ ] Timeouts on all external calls
  - [ ] Efficient database queries (LIMIT 1, indexes)
  - [ ] No N+1 query patterns

### 2.3 Database / SQL

- [ ] **Schema Design**
  - [ ] Primary keys on all tables
  - [ ] Foreign keys where applicable (none in this system)
  - [ ] Appropriate indexes (email_hash, expires_at, bucket_time)
  - [ ] Unique constraints (email_hash on verification_codes)

- [ ] **Query Optimization**
  - [ ] EXPLAIN ANALYZE on critical queries
  - [ ] Index usage verified
  - [ ] No full table scans
  - [ ] Efficient cleanup queries

- [ ] **Migration Safety**
  - [ ] Migrations idempotent (CREATE IF NOT EXISTS)
  - [ ] Rollback scripts provided
  - [ ] Tested in staging before production
  - [ ] No data loss on migration

---

## 3. Reliability Review

### 3.1 Fail-Closed Policy

- [ ] **Orphan Detection**
  - [ ] 3 retry attempts with exponential backoff
  - [ ] If all retries fail: block login (don't allow access)
  - [ ] Clear error message to user
  - [ ] Logged with correlation ID for investigation

- [ ] **Graceful Degradation (Email Probe Only)**
  - [ ] Email status probe failures don't block registration
  - [ ] Returns null for isOrphaned/hasCompanyData on error
  - [ ] User can proceed (backend validates uniqueness)
  - [ ] Logged as warning

### 3.2 Email Delivery

- [ ] **Dual Provider Strategy**
  - [ ] Primary: Resend
  - [ ] Fallback: SendGrid
  - [ ] 3 retry attempts per provider (immediate, +1s, +2s)
  - [ ] Fallback triggered after all Resend attempts fail
  - [ ] Both providers configured and tested

- [ ] **DNS Configuration**
  - [ ] SPF record includes both providers
  - [ ] DKIM records for both providers
  - [ ] DMARC record configured (p=none initially)
  - [ ] Dedicated subdomain (auth.yourdomain.com)
  - [ ] All records verified with dig commands

### 3.3 Database Transactions

- [ ] **Atomic Operations**
  - [ ] User deletion and log update in same transaction (if possible)
  - [ ] Rate limit check and increment atomic
  - [ ] Advisory lock acquisition atomic
  - [ ] No partial state on errors

- [ ] **Connection Management**
  - [ ] Connection pool configured
  - [ ] Connections always closed
  - [ ] No connection leaks
  - [ ] Handles connection failures gracefully

---

## 4. Performance Review

### 4.1 Orphan Detection

- [ ] **Performance Targets**
  - [ ] p50 < 100ms
  - [ ] p95 < 200ms
  - [ ] p99 < 500ms
  - [ ] Timeout: 500ms per attempt

- [ ] **Optimization**
  - [ ] Parallel queries (companies + company_admins)
  - [ ] Indexes on foreign keys (owner_admin_uuid, admin_uuid)
  - [ ] LIMIT 1 on queries (early termination)
  - [ ] Performance metrics logged

### 4.2 Edge Function Response Times

- [ ] **Constant-Time Target**
  - [ ] ~500ms ±50ms (including network)
  - [ ] Tested with multiple scenarios
  - [ ] Variance acceptable (<100ms)

- [ ] **Cold Start Performance**
  - [ ] Edge function cold starts < 200ms
  - [ ] No large dependencies causing slow starts
  - [ ] Tested with multiple cold starts

### 4.3 Frontend Performance

- [ ] **Email Probe Debouncing**
  - [ ] 450ms debounce on email input
  - [ ] Prevents excessive API calls
  - [ ] Cancel in-flight requests on input change

- [ ] **Caching**
  - [ ] Email status cached for 2 minutes
  - [ ] Reduces redundant API calls
  - [ ] Force refresh option available

- [ ] **Code Splitting**
  - [ ] Recovery components lazy loaded
  - [ ] Route-based code splitting
  - [ ] No unnecessary bundles loaded

---

## 5. Observability Review

### 5.1 Logging

- [ ] **Correlation ID Propagation**
  - [ ] Generated in frontend (crypto.randomUUID())
  - [ ] Passed in x-correlation-id header
  - [ ] Returned in response headers
  - [ ] Logged at every step
  - [ ] Used for end-to-end tracing

- [ ] **Structured Logging**
  - [ ] JSON format
  - [ ] Consistent schema (level, message, correlation_id, email_hash, etc.)
  - [ ] No PII in plaintext
  - [ ] Appropriate log levels

### 5.2 Metrics

- [ ] **Orphan Detection Metrics**
  - [ ] totalDurationMs, queryDurationMs
  - [ ] attemptCount, timedOut, hadError
  - [ ] isOrphaned result
  - [ ] Logged for every detection

- [ ] **Cleanup Metrics**
  - [ ] Request volume (per hour)
  - [ ] Success rate (completed / total)
  - [ ] Error code distribution
  - [ ] Email delivery success rate
  - [ ] Logged in auth_cleanup_log

- [ ] **Rate Limit Metrics**
  - [ ] Hits per tier (global, IP, email)
  - [ ] Current counts and windows
  - [ ] 429 response counts
  - [ ] Logged in rate_limits table

### 5.3 Dashboards

- [ ] **Orphan Detection Health Dashboard**
  - [ ] Detection duration (p50, p95, p99)
  - [ ] Error rate gauge
  - [ ] Timeout rate gauge
  - [ ] Orphan vs non-orphan count

- [ ] **Cleanup Operations Dashboard**
  - [ ] Request volume
  - [ ] Success rate gauge
  - [ ] Error code distribution
  - [ ] Average cleanup time

- [ ] **Rate Limiting Dashboard**
  - [ ] Hit count by tier
  - [ ] Unique IPs hitting limits
  - [ ] Failed validation attempts
  - [ ] Concurrent cleanup attempts

### 5.4 Alerts

- [ ] **Critical Alerts (PagerDuty)**
  - [ ] Orphan detection error rate > 10% for 5 min
  - [ ] Cleanup success rate < 90% for 10 min
  - [ ] Global rate limit exhausted > 5x in 1 hour

- [ ] **Warning Alerts (Slack)**
  - [ ] Orphan detection p95 > 300ms for 15 min
  - [ ] Email bounce rate > 0.5% for 1 hour
  - [ ] Graceful degradation rate > 5% for 15 min

---

## 6. Testing Review

### 6.1 Unit Tests

- [ ] **Orphan Detection**
  - [ ] Case 1.1 (unverified + orphaned)
  - [ ] Case 1.2 (verified + orphaned)
  - [ ] Non-orphaned users
  - [ ] Timeout scenarios
  - [ ] Error scenarios
  - [ ] Retry logic

- [ ] **Verification Code**
  - [ ] Code generation (entropy, uniqueness)
  - [ ] Hash storage (salt uniqueness)
  - [ ] Constant-time validation
  - [ ] Expiry enforcement

- [ ] **Rate Limiting**
  - [ ] Global limit enforcement
  - [ ] Per-IP limit enforcement
  - [ ] Per-email limit enforcement
  - [ ] Retry-After calculation
  - [ ] Bucket cleanup

### 6.2 Integration Tests

- [ ] **Login Flow**
  - [ ] Login as orphaned user → redirect to recovery
  - [ ] Login as non-orphaned user → success
  - [ ] Login with detection timeout → blocked
  - [ ] Orphan detection performance measured

- [ ] **Registration Retry**
  - [ ] Email probe detects orphaned user
  - [ ] Show recovery options
  - [ ] Cleanup flow initiated
  - [ ] User can re-register after cleanup

- [ ] **Recovery Flow**
  - [ ] Request code → email sent
  - [ ] Enter code → user deleted
  - [ ] Invalid code → error shown
  - [ ] Expired code → error shown with resend option

### 6.3 End-to-End Tests

- [ ] **Complete Recovery Journey**
  - [ ] User starts registration → fails
  - [ ] User tries login → orphan detected
  - [ ] User receives verification code
  - [ ] User enters code → account cleaned up
  - [ ] User registers successfully
  - [ ] User logs in successfully

- [ ] **Edge Cases**
  - [ ] Concurrent cleanup attempts → 409 Conflict
  - [ ] User completes registration between steps → ORPHAN_CLEANUP_005
  - [ ] Email delivery failure → fallback provider used
  - [ ] Rate limit hit → 429 with retry-after
  - [ ] Code expiry → resend option shown

### 6.4 Performance Tests

- [ ] **Load Testing**
  - [ ] 100 concurrent users
  - [ ] Orphan detection p95 < 200ms maintained
  - [ ] Edge function response times stable
  - [ ] Database connections stable
  - [ ] No memory leaks

- [ ] **Stress Testing**
  - [ ] 1000 concurrent users
  - [ ] System degrades gracefully
  - [ ] Rate limiting effective
  - [ ] No crashes or data corruption

### 6.5 Security Tests

- [ ] **Timing Attacks**
  - [ ] Response times consistent (±100ms)
  - [ ] Cannot determine email existence
  - [ ] Cannot determine code validity
  - [ ] Cannot determine orphan status

- [ ] **Rate Limit Bypass Attempts**
  - [ ] Cannot bypass with IP rotation
  - [ ] Cannot bypass with email variation
  - [ ] Headers correctly enforced

- [ ] **Code Brute Force**
  - [ ] Rate limiting prevents brute force
  - [ ] Account lockout after 3 attempts
  - [ ] Codes expire after 5 minutes

---

## 7. Documentation Review

- [ ] **API Documentation**
  - [ ] cleanup-orphaned-user API complete
  - [ ] check-email-status API complete
  - [ ] Request/response schemas documented
  - [ ] Error codes documented with examples
  - [ ] Rate limiting explained
  - [ ] Code examples provided

- [ ] **Operational Runbook**
  - [ ] Monitoring procedures documented
  - [ ] Investigation procedures clear
  - [ ] Service role key rotation documented
  - [ ] Rate limit adjustment procedures
  - [ ] Manual cleanup procedures
  - [ ] Escalation procedures

- [ ] **Architecture Decision Records**
  - [ ] All major decisions documented (ADR-001 through ADR-010)
  - [ ] Rationale clear
  - [ ] Trade-offs explained
  - [ ] Alternatives considered

- [ ] **Deployment Guide**
  - [ ] Database migrations documented
  - [ ] Supabase Vault setup clear
  - [ ] Email infrastructure steps complete
  - [ ] Edge function deployment steps
  - [ ] Frontend deployment steps
  - [ ] Monitoring setup documented
  - [ ] Smoke tests provided
  - [ ] Gradual rollout strategy clear
  - [ ] Rollback procedures complete

- [ ] **Testing Guide**
  - [ ] How to create test orphaned users
  - [ ] How to run unit tests
  - [ ] How to run integration tests
  - [ ] How to run E2E tests
  - [ ] How to run performance tests
  - [ ] How to test email delivery

---

## 8. Deployment Readiness

### 8.1 Pre-Deployment Checklist

- [ ] All code reviewed and approved by 2+ engineers
- [ ] Security audit complete (this checklist)
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance tests meet targets
- [ ] Security tests pass
- [ ] Staging environment fully tested
- [ ] Database migrations tested in staging
- [ ] Edge functions deployed to staging
- [ ] Frontend deployed to staging
- [ ] Smoke tests pass in staging
- [ ] Monitoring dashboards created
- [ ] Alerts configured and tested
- [ ] Rollback procedures reviewed
- [ ] On-call engineer assigned
- [ ] Stakeholders notified

### 8.2 Sign-Off

**Engineering Lead**: ______________________ Date: __________

**Security Reviewer**: ______________________ Date: __________

**DevOps/SRE**: ______________________ Date: __________

**Product Manager**: ______________________ Date: __________

---

## 9. Post-Deployment Monitoring

### First 24 Hours

- [ ] Monitor error rates every hour
- [ ] Check orphan detection performance
- [ ] Verify cleanup success rate > 98%
- [ ] Review email delivery success
- [ ] Check for unexpected alerts
- [ ] Review user feedback/support tickets
- [ ] No critical issues detected

### First Week

- [ ] Daily review of metrics
- [ ] Gradual rollout milestones met
- [ ] User adoption tracking
- [ ] Performance trends stable
- [ ] No security incidents
- [ ] Support tickets manageable

### First Month

- [ ] Weekly metrics review
- [ ] Long-term performance trends
- [ ] Optimization opportunities identified
- [ ] User feedback incorporated
- [ ] Operational runbook updated
- [ ] Team training complete

---

## 10. Common Issues Checklist

### Issue: High Error Rate

- [ ] Check database connection pool
- [ ] Verify Vault secret accessible
- [ ] Check edge function logs for exceptions
- [ ] Verify DNS records (SPF, DKIM, DMARC)
- [ ] Check ESP status pages
- [ ] Review recent code changes

### Issue: Slow Orphan Detection

- [ ] Verify indexes exist and used
- [ ] Check database query performance (EXPLAIN ANALYZE)
- [ ] Review database connection pool size
- [ ] Check for slow queries in PostgreSQL logs
- [ ] Monitor database CPU/memory usage
- [ ] Consider scaling database instance

### Issue: Email Delivery Failures

- [ ] Check ESP status pages (Resend, SendGrid)
- [ ] Verify DNS records propagated
- [ ] Check bounce rate in ESP dashboard
- [ ] Review email content for spam triggers
- [ ] Verify sender reputation
- [ ] Check ESP API rate limits

### Issue: Rate Limit False Positives

- [ ] Review rate limit hit patterns
- [ ] Check for legitimate high-traffic scenarios
- [ ] Adjust rate limits if needed
- [ ] Whitelist trusted IPs (if applicable)
- [ ] Review rate limit bucket cleanup

---

**Document Version**: 1.0
**Last Updated**: 2025-01-28
**Review Before Production Deployment**
