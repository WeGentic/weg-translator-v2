<map version="freeplane 1.11.5">
<!--Registration Edge Case Fix - Orphaned User Account Handling-->
<node TEXT="Registration Edge Case Fix" FOLDED="false" ID="ID_ROOT" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="18" BOLD="true"/>
<edge COLOR="#808080"/>

<!-- Overview Section -->
<node TEXT="📋 Overview" POSITION="left" ID="ID_OVERVIEW" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Project: registration-edge-case-fix" ID="ID_PROJECT_NAME">
<node TEXT="Fix orphaned user accounts in registration flow"/>
<node TEXT="Handle Case 1.1: Unverified email, no DB data"/>
<node TEXT="Handle Case 1.2: Verified email, no DB data"/>
</node>
<node TEXT="Success Criteria" ID="ID_SUCCESS">
<node TEXT="Zero orphaned accounts &gt; 10 minutes"/>
<node TEXT="Seamless user recovery"/>
<node TEXT="Secure cleanup without auth session"/>
<node TEXT="Performance: &lt;200ms p95 orphan detection"/>
</node>
<node TEXT="Estimated Timeline: 4-6 weeks"/>
</node>

<!-- BLOCKING Issues Section -->
<node TEXT="⛔ BLOCKING Issues" POSITION="right" ID="ID_BLOCKING" CREATED="1735387200000" MODIFIED="1735387200000" COLOR="#ff0000">
<font SIZE="14" BOLD="true"/>
<node TEXT="1. Deno KV Not Available" ID="ID_BLOCK_1" COLOR="#ff0000">
<font BOLD="true"/>
<node TEXT="Problem: Design assumes Deno KV for Edge Functions"/>
<node TEXT="Solution: Use Postgres for verification codes &amp; locks"/>
<node TEXT="Impact: HIGH - Complete storage redesign"/>
<node TEXT="Tasks: 0.1, 0.2, 0.3 (verification_codes, rate_limits, advisory locks)"/>
</node>
<node TEXT="2. Fail-Open Security Issue" ID="ID_BLOCK_2" COLOR="#ff6600">
<font BOLD="true"/>
<node TEXT="Problem: Allows login when orphan detection fails"/>
<node TEXT="Solution: Block access (fail-closed) with error message"/>
<node TEXT="Impact: MEDIUM - AuthProvider logic change"/>
<node TEXT="Tasks: 0.5, 0.9 (fail-closed policy, retry logic)"/>
</node>
<node TEXT="3. Environment Variable Storage" ID="ID_BLOCK_3" COLOR="#ff9900">
<font BOLD="true"/>
<node TEXT="Problem: Service role key in env vars (outdated)"/>
<node TEXT="Solution: Use Supabase Vault for secret storage"/>
<node TEXT="Impact: MEDIUM - Edge function refactor"/>
<node TEXT="Tasks: 0.6 (Vault integration design)"/>
</node>
</node>

<!-- Requirements Section -->
<node TEXT="📝 Requirements (15 Total)" POSITION="left" ID="ID_REQUIREMENTS" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Core Requirements" ID="ID_REQ_CORE">
<node TEXT="Req#1: Orphan Detection Case 1.1 (Unverified)"/>
<node TEXT="Req#2: Orphan Detection Case 1.2 (Verified)"/>
<node TEXT="Req#3: Cleanup Edge Function Without Auth"/>
<node TEXT="Req#4: Enhanced Login Flow"/>
<node TEXT="Req#5: Enhanced Registration Flow"/>
</node>
<node TEXT="User Experience" ID="ID_REQ_UX">
<node TEXT="Req#6: User Notifications &amp; Feedback"/>
<node TEXT="Req#10: Recovery Route &amp; Form"/>
</node>
<node TEXT="Technical" ID="ID_REQ_TECH">
<node TEXT="Req#7: Data Integrity &amp; Atomicity"/>
<node TEXT="Req#8: Security Without Auth"/>
<node TEXT="Req#9: Email Status Checking"/>
<node TEXT="Req#11: Performance Monitoring"/>
</node>
<node TEXT="Operational" ID="ID_REQ_OPS">
<node TEXT="Req#12: Testing &amp; Validation"/>
<node TEXT="Req#13: Documentation"/>
<node TEXT="Req#14: Edge Cases &amp; Error Recovery"/>
<node TEXT="Req#15: Migration &amp; Rollback"/>
</node>
<node TEXT="Non-Functional: 35 NFRs" ID="ID_NFR">
<node TEXT="Performance: NFR-1 to NFR-5"/>
<node TEXT="Security: NFR-9 to NFR-15"/>
<node TEXT="Privacy: NFR-16 to NFR-18"/>
<node TEXT="Reliability: NFR-32 to NFR-35"/>
</node>
</node>

<!-- Design Components Section -->
<node TEXT="🏗️ Design Components" POSITION="right" ID="ID_DESIGN" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Frontend Components" ID="ID_FRONTEND">
<node TEXT="RecoveryForm" ID="ID_COMP_RECOVERY">
<node TEXT="8-char alphanumeric code entry with auto-format"/>
<node TEXT="Resend functionality with cooldown"/>
<node TEXT="Error display &amp; retry logic"/>
<node TEXT="Location: src/modules/auth/components/RecoveryForm.tsx"/>
</node>
<node TEXT="Enhanced EmailStatusBanner" ID="ID_COMP_BANNER">
<node TEXT="Show orphan status during registration"/>
<node TEXT="Actionable buttons (Recover/Resend)"/>
<node TEXT="Location: src/modules/auth/components/forms/EmailStatusBanner.tsx"/>
</node>
<node TEXT="orphanDetection.ts" ID="ID_COMP_ORPHAN">
<node TEXT="Parallel queries to companies &amp; company_admins"/>
<node TEXT="500ms timeout with 3 retry attempts"/>
<node TEXT="Fail-closed on timeout/error"/>
<node TEXT="Location: src/modules/auth/utils/orphanDetection.ts"/>
</node>
</node>
<node TEXT="Backend Components" ID="ID_BACKEND">
<node TEXT="cleanup-orphaned-user Edge Function" ID="ID_EDGE_CLEANUP">
<node TEXT="Step 1: Generate &amp; email verification code"/>
<node TEXT="Step 2: Validate code &amp; delete user"/>
<node TEXT="Postgres storage (verification_codes table)"/>
<node TEXT="PostgreSQL advisory locks for distributed locking"/>
<node TEXT="Constant-time responses (500ms ± Gaussian jitter)"/>
<node TEXT="Location: supabase/functions/cleanup-orphaned-user/"/>
</node>
<node TEXT="check-email-status Edge Function" ID="ID_EDGE_CHECK">
<node TEXT="Enhanced to return isOrphaned flag"/>
<node TEXT="Check companies &amp; company_admins tables"/>
<node TEXT="Location: supabase/functions/check-email-status/"/>
</node>
</node>
<node TEXT="Database Schema" ID="ID_DATABASE">
<node TEXT="verification_codes table" ID="ID_TABLE_CODES">
<node TEXT="Columns: id, email_hash, code_hash, code_salt, correlation_id, expires_at, created_at"/>
<node TEXT="5-minute TTL via expires_at check"/>
<node TEXT="Unique constraint on email_hash"/>
</node>
<node TEXT="rate_limits table" ID="ID_TABLE_RATE">
<node TEXT="Columns: key, bucket_time, count"/>
<node TEXT="Bucketed sliding window (1-second buckets)"/>
<node TEXT="PostgreSQL function: check_rate_limit()"/>
</node>
<node TEXT="auth_cleanup_log table">
<node TEXT="Audit trail (already exists)"/>
</node>
</node>
</node>

<!-- Implementation Phases Section -->
<node TEXT="🚀 Implementation (76 Tasks)" POSITION="left" ID="ID_PHASES" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Phase 0: Critical Design Revisions (10 tasks)" ID="ID_PHASE0" COLOR="#ff0000">
<font BOLD="true"/>
<node TEXT="0.1: Design Postgres verification code storage"/>
<node TEXT="0.2: Design Postgres rate limiting system"/>
<node TEXT="0.3: Design PostgreSQL advisory locks"/>
<node TEXT="0.4: Design 8-char alphanumeric codes"/>
<node TEXT="0.5: Design fail-closed graceful degradation"/>
<node TEXT="0.6: Design Supabase Vault integration"/>
<node TEXT="0.7: Design Gaussian jitter for constant-time"/>
<node TEXT="0.8: Document email infrastructure (SPF/DKIM/DMARC)"/>
<node TEXT="0.9: Update orphan detection for fail-closed"/>
<node TEXT="0.10: Create Phase 0 validation checklist"/>
</node>
<node TEXT="Phase 1: Foundation &amp; Core Detection (8 tasks)" ID="ID_PHASE1">
<node TEXT="1.1: Create verification_codes table migration"/>
<node TEXT="1.2: Create rate_limits table migration"/>
<node TEXT="1.3: Create PostgreSQL check_rate_limit() function"/>
<node TEXT="1.4: Implement 8-char code generation utility"/>
<node TEXT="1.5: Enhance orphanDetection.ts with fail-closed retry"/>
<node TEXT="1.6: Create unit tests for orphan detection"/>
<node TEXT="1.7: Create OrphanedUserError class enhancements"/>
<node TEXT="1.8: Document orphan detection architecture"/>
</node>
<node TEXT="Phase 2: Cleanup Edge Function Core (15 tasks)" ID="ID_PHASE2">
<node TEXT="2.1: Initialize cleanup-orphaned-user edge function"/>
<node TEXT="2.2: Implement Supabase Vault secret retrieval"/>
<node TEXT="2.3: Implement PostgreSQL advisory lock wrapper"/>
<node TEXT="2.4: Implement Step 1 - code generation &amp; storage"/>
<node TEXT="2.5: Implement Step 1 - email sending with Resend/SendGrid"/>
<node TEXT="2.6: Implement Step 2 - code validation (constant-time)"/>
<node TEXT="2.7: Implement Step 2 - user deletion via admin API"/>
<node TEXT="2.8: Implement Gaussian jitter for constant-time"/>
<node TEXT="2.9: Implement rate limiting checks (3-tier)"/>
<node TEXT="2.10: Implement audit logging to auth_cleanup_log"/>
<node TEXT="2.11: Implement request validation (Zod schemas)"/>
<node TEXT="2.12: Implement correlation ID propagation"/>
<node TEXT="2.13: Implement comprehensive error handling"/>
<node TEXT="2.14: Create unit tests for edge function"/>
<node TEXT="2.15: Create integration tests for 2-step flow"/>
</node>
<node TEXT="Phase 3: Enhanced Email Status Probe (8 tasks)" ID="ID_PHASE3">
<node TEXT="3.1: Enhance check-email-status to return isOrphaned"/>
<node TEXT="3.2: Update useEmailStatusProbe to handle orphan state"/>
<node TEXT="3.3: Update EmailStatusBanner for orphan display"/>
<node TEXT="3.4: Implement recovery action buttons"/>
<node TEXT="3.5: Implement email probe unit tests"/>
<node TEXT="3.6: Implement banner integration tests"/>
<node TEXT="3.7: Update RegistrationForm to handle probe results"/>
<node TEXT="3.8: Document email status probe flow"/>
</node>
<node TEXT="Phase 4: Recovery Form &amp; Frontend Flow (10 tasks)" ID="ID_PHASE4">
<node TEXT="4.1: Create RecoveryRoute.tsx with route definition"/>
<node TEXT="4.2: Create RecoveryForm.tsx component"/>
<node TEXT="4.3: Implement code input with auto-formatting (XXXX-XXXX)"/>
<node TEXT="4.4: Implement resend functionality with cooldown"/>
<node TEXT="4.5: Implement error display &amp; validation"/>
<node TEXT="4.6: Implement success flow (redirect to registration)"/>
<node TEXT="4.7: Create cleanupOrphanedUser.ts client utility"/>
<node TEXT="4.8: Implement recovery form unit tests"/>
<node TEXT="4.9: Implement recovery route integration tests"/>
<node TEXT="4.10: Document recovery user journey"/>
</node>
<node TEXT="Phase 5: Login Flow Integration (10 tasks)" ID="ID_PHASE5">
<node TEXT="5.1: Update AuthProvider.login() with fail-closed logic"/>
<node TEXT="5.2: Implement 3-attempt retry with exponential backoff"/>
<node TEXT="5.3: Update error messages for service unavailability"/>
<node TEXT="5.4: Implement redirect to recovery route on orphan"/>
<node TEXT="5.5: Implement toast notifications for orphan detection"/>
<node TEXT="5.6: Update LoginForm error handling"/>
<node TEXT="5.7: Update cleanupInitiation.ts (fire-and-forget call)"/>
<node TEXT="5.8: Create login flow unit tests"/>
<node TEXT="5.9: Create login integration tests (orphan scenarios)"/>
<node TEXT="5.10: Document login flow with orphan handling"/>
</node>
<node TEXT="Phase 6: Testing, Docs, Deployment (15 tasks)" ID="ID_PHASE6">
<node TEXT="6.1: Create E2E tests (Case 1.1 &amp; 1.2 full flows)"/>
<node TEXT="6.2: Create performance tests (orphan detection &lt;200ms)"/>
<node TEXT="6.3: Create security tests (constant-time, rate limiting)"/>
<node TEXT="6.4: Create email delivery tests (Resend/SendGrid fallback)"/>
<node TEXT="6.5: Document SPF/DKIM/DMARC setup procedures"/>
<node TEXT="6.6: Document Supabase Vault configuration"/>
<node TEXT="6.7: Create operational runbook (monitoring, alerts)"/>
<node TEXT="6.8: Create architecture decision records (ADRs)"/>
<node TEXT="6.9: Create deployment plan (feature flags)"/>
<node TEXT="6.10: Create rollback procedures"/>
<node TEXT="6.11: Set up monitoring dashboards (bounce rate, cleanup success)"/>
<node TEXT="6.12: Configure alerts (timeout spikes, failure rate)"/>
<node TEXT="6.13: Create user-facing help documentation"/>
<node TEXT="6.14: Conduct code review &amp; security audit"/>
<node TEXT="6.15: Deploy to staging &amp; production (gradual rollout)"/>
</node>
</node>

<!-- Testing Strategy Section -->
<node TEXT="🧪 Testing Strategy" POSITION="right" ID="ID_TESTING" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Unit Tests" ID="ID_TEST_UNIT">
<node TEXT="Orphan detection logic (parallel queries, timeout, retry)"/>
<node TEXT="8-char code generation (CSPRNG, entropy)"/>
<node TEXT="Constant-time comparison &amp; Gaussian jitter"/>
<node TEXT="PostgreSQL advisory lock acquire/release"/>
<node TEXT="Rate limiting logic (bucketed sliding window)"/>
</node>
<node TEXT="Integration Tests" ID="ID_TEST_INTEGRATION">
<node TEXT="2-step cleanup flow (Step 1 → Step 2)"/>
<node TEXT="Email status probe with orphan detection"/>
<node TEXT="Login flow with orphan redirect"/>
<node TEXT="Recovery form submission &amp; success"/>
<node TEXT="Edge function error handling (timeout, invalid code)"/>
</node>
<node TEXT="End-to-End Tests" ID="ID_TEST_E2E">
<node TEXT="Case 1.1: Unverified orphan → cleanup → re-register"/>
<node TEXT="Case 1.2: Verified orphan → cleanup → re-register"/>
<node TEXT="Rate limiting enforcement (block after limit)"/>
<node TEXT="Email delivery with Resend → SendGrid fallover"/>
</node>
<node TEXT="Performance Tests" ID="ID_TEST_PERF">
<node TEXT="Orphan detection &lt;200ms p95 target"/>
<node TEXT="Constant-time response verification (500ms ±statistical)"/>
<node TEXT="Rate limit function &lt;50ms execution"/>
</node>
<node TEXT="Security Tests" ID="ID_TEST_SECURITY">
<node TEXT="Timing attack resistance (statistical analysis)"/>
<node TEXT="Code hash storage (no plaintext in DB)"/>
<node TEXT="Advisory lock race condition handling"/>
<node TEXT="Rate limiting bypass attempts"/>
</node>
</node>

<!-- Deployment Plan Section -->
<node TEXT="🚢 Deployment Plan" POSITION="left" ID="ID_DEPLOYMENT" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Pre-Deployment" ID="ID_DEPLOY_PRE">
<node TEXT="Complete Phase 0 validation checklist"/>
<node TEXT="Create database migrations (verification_codes, rate_limits)"/>
<node TEXT="Set up Supabase Vault with service role key"/>
<node TEXT="Configure DNS records (SPF/DKIM/DMARC)"/>
<node TEXT="Set up email service accounts (Resend, SendGrid)"/>
</node>
<node TEXT="Deployment Steps" ID="ID_DEPLOY_STEPS">
<node TEXT="1. Deploy database migrations to staging"/>
<node TEXT="2. Deploy edge functions to staging"/>
<node TEXT="3. Deploy frontend changes to staging"/>
<node TEXT="4. Run full test suite on staging"/>
<node TEXT="5. Enable feature flag for 10% traffic"/>
<node TEXT="6. Monitor metrics (orphan cleanup rate, errors)"/>
<node TEXT="7. Gradual rollout: 10% → 50% → 100%"/>
</node>
<node TEXT="Monitoring" ID="ID_DEPLOY_MONITOR">
<node TEXT="Orphan detection timeout rate"/>
<node TEXT="Cleanup success rate (Step 1 + Step 2)"/>
<node TEXT="Email delivery rate &amp; bounce rate"/>
<node TEXT="Rate limiting trigger frequency"/>
<node TEXT="Performance metrics (p50, p95, p99)"/>
</node>
<node TEXT="Rollback Plan" ID="ID_DEPLOY_ROLLBACK">
<node TEXT="Disable feature flag immediately"/>
<node TEXT="Revert edge function deployment"/>
<node TEXT="Revert frontend deployment"/>
<node TEXT="Database schema rollback (if needed)"/>
<node TEXT="Notify users of service restoration"/>
</node>
</node>

<!-- Key Decisions Section -->
<node TEXT="🔑 Key Decisions" POSITION="right" ID="ID_DECISIONS" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Decision 1: Postgres over Deno KV" ID="ID_DEC_1">
<node TEXT="Rationale: Deno KV not available in Supabase Edge Functions"/>
<node TEXT="Trade-off: Slightly higher latency, but durable &amp; consistent"/>
<node TEXT="Alternative considered: External Redis (Upstash) - adds dependency"/>
</node>
<node TEXT="Decision 2: Fail-Closed Policy" ID="ID_DEC_2">
<node TEXT="Rationale: Security &gt; availability for authentication"/>
<node TEXT="Trade-off: May inconvenience users during outages"/>
<node TEXT="Mitigation: Retry logic (3 attempts) reduces false positives"/>
</node>
<node TEXT="Decision 3: 8-Character Alphanumeric Codes" ID="ID_DEC_3">
<node TEXT="Rationale: Account recovery requires higher entropy than signup"/>
<node TEXT="Trade-off: Harder to type vs 6-digit, but 2.8T combinations"/>
<node TEXT="UX improvement: Auto-format with hyphen (XXXX-XXXX)"/>
</node>
<node TEXT="Decision 4: PostgreSQL Advisory Locks" ID="ID_DEC_4">
<node TEXT="Rationale: Built-in, no external dependencies"/>
<node TEXT="Trade-off: Connection-based lifecycle"/>
<node TEXT="Alternative considered: Row-level locks (FOR UPDATE NOWAIT)"/>
</node>
<node TEXT="Decision 5: Supabase Vault" ID="ID_DEC_5">
<node TEXT="Rationale: 2025 best practice, encrypted storage"/>
<node TEXT="Trade-off: Requires setup, adds retrieval step"/>
<node TEXT="Fallback: Allow env vars in dev with warning"/>
</node>
</node>

<!-- Risks Section -->
<node TEXT="⚠️ Risks &amp; Mitigations" POSITION="left" ID="ID_RISKS" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Risk 1: Orphan Detection Timeout Spike" ID="ID_RISK_1" COLOR="#ff6600">
<node TEXT="Impact: Users blocked from login (fail-closed)"/>
<node TEXT="Mitigation: 3-retry logic, performance monitoring, database indexing"/>
<node TEXT="Fallback: Temporarily disable orphan check via feature flag"/>
</node>
<node TEXT="Risk 2: Email Delivery Failures" ID="ID_RISK_2" COLOR="#ff9900">
<node TEXT="Impact: Users cannot receive verification codes"/>
<node TEXT="Mitigation: Resend → SendGrid fallback, bounce monitoring"/>
<node TEXT="Fallback: Manual code generation by support team"/>
</node>
<node TEXT="Risk 3: PostgreSQL Advisory Lock Contention" ID="ID_RISK_3" COLOR="#ffcc00">
<node TEXT="Impact: Concurrent cleanup attempts fail"/>
<node TEXT="Mitigation: Return 409 Conflict, client retries after delay"/>
<node TEXT="Monitoring: Track lock acquisition failure rate"/>
</node>
<node TEXT="Risk 4: Code Expiry Race Condition" ID="ID_RISK_4" COLOR="#ffff99">
<node TEXT="Impact: Code expires between Step 1 and Step 2"/>
<node TEXT="Mitigation: 5-minute expiry sufficient for email delivery"/>
<node TEXT="UX: Clear error message, allow resend"/>
</node>
<node TEXT="Risk 5: Rate Limiting False Positives" ID="ID_RISK_5" COLOR="#ffff99">
<node TEXT="Impact: Legitimate users blocked"/>
<node TEXT="Mitigation: Tiered limits (global/IP/email), monitoring"/>
<node TEXT="Escalation: Support can manually clear rate limit entries"/>
</node>
</node>

<!-- Success Metrics Section -->
<node TEXT="📊 Success Metrics" POSITION="right" ID="ID_METRICS" CREATED="1735387200000" MODIFIED="1735387200000">
<font SIZE="14" BOLD="true"/>
<node TEXT="Primary Metrics" ID="ID_METRICS_PRIMARY">
<node TEXT="Orphaned Account Count: Target = 0 after 10 minutes"/>
<node TEXT="Cleanup Success Rate: Target &gt; 95%"/>
<node TEXT="Orphan Detection Performance: Target &lt; 200ms p95"/>
<node TEXT="Email Delivery Rate: Target &gt; 99%"/>
</node>
<node TEXT="Secondary Metrics" ID="ID_METRICS_SECONDARY">
<node TEXT="Recovery Completion Rate: % users completing recovery"/>
<node TEXT="Code Resend Rate: Track user confusion"/>
<node TEXT="Timeout Error Rate: Monitor detection stability"/>
<node TEXT="Rate Limit Trigger Rate: Detect abuse patterns"/>
</node>
<node TEXT="User Experience Metrics" ID="ID_METRICS_UX">
<node TEXT="Time to Recovery: From orphan detection to re-registration"/>
<node TEXT="Support Tickets: Track orphan-related issues"/>
<node TEXT="User Satisfaction: Post-recovery surveys"/>
</node>
</node>

</node>
</map>