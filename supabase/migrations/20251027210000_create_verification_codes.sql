-- Migration: Create verification_codes table
-- Purpose: Store hashed verification codes for orphaned user cleanup operations
-- Author: Claude Code (registration-edge-case-fix Phase 1)
-- Date: 2025-10-27
-- Requirements: Req#3 (Cleanup Edge Function), Req#8 (Security), NFR-10 (Hash storage), NFR-12 (Code expiry)

-- ============================================================================
-- verification_codes table
-- ============================================================================
-- This table stores verification codes used in the two-step orphaned user
-- cleanup flow. Codes are stored as SHA-256 hashes with unique salts for
-- security. Each code expires after 5 minutes.
--
-- Key Features:
-- - Hash-based storage (codes never stored in plaintext)
-- - Automatic expiry after 5 minutes
-- - Unique constraint prevents multiple codes per email
-- - Efficient indexes for lookup and cleanup
-- ============================================================================

CREATE TABLE verification_codes (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email identification (hashed for privacy)
  -- SHA-256 hash of lowercase, trimmed email address
  -- Format: 64-character hexadecimal string
  email_hash TEXT NOT NULL,

  -- Code storage (hash + salt for security)
  -- SHA-256 hash of verification code + salt (32 bytes)
  code_hash BYTEA NOT NULL,

  -- Random 16-byte salt for hash computation
  code_salt BYTEA NOT NULL,

  -- Tracing and audit
  -- UUID for end-to-end request tracing
  correlation_id UUID NOT NULL,

  -- Time-based expiry (5-minute TTL)
  -- Codes invalid after this timestamp
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),

  -- Audit trail timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  -- Prevents multiple active codes per email address
  CONSTRAINT verification_codes_email_hash_unique UNIQUE (email_hash)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Fast lookup by email hash (primary query pattern)
-- Used for code validation: WHERE email_hash = ? AND expires_at > NOW()
-- Expected: Index scan → single row fetch, <5ms latency
CREATE INDEX idx_verification_codes_email_hash
  ON verification_codes(email_hash);

-- Efficient expiry cleanup queries
-- Used by cleanup job: WHERE expires_at < NOW()
-- Expected: Index scan → batch delete, <50ms for 1000 rows
CREATE INDEX idx_verification_codes_expires_at
  ON verification_codes(expires_at);

-- Audit trail queries by correlation ID
-- Used for debugging and tracing: WHERE correlation_id = ?
-- Expected: Index scan → single row fetch, <5ms latency
CREATE INDEX idx_verification_codes_correlation_id
  ON verification_codes(correlation_id);

-- ============================================================================
-- Cleanup Function
-- ============================================================================
-- Function to delete expired verification codes
-- Should be invoked every 5 minutes via cron job or edge function
-- Returns: count of deleted rows

CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete all codes past their expiry time
  DELETE FROM verification_codes
  WHERE expires_at < NOW();

  -- Get count of deleted rows
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log cleanup event (visible in Postgres logs)
  RAISE NOTICE 'Cleaned up % expired verification codes at %',
    deleted_count,
    NOW();

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for Schema Documentation
-- ============================================================================

COMMENT ON TABLE verification_codes IS
  'Stores hashed verification codes for orphaned user cleanup operations. ' ||
  'Codes expire after 5 minutes. Each email can have only one active code.';

COMMENT ON COLUMN verification_codes.email_hash IS
  'SHA-256 hash of lowercase, trimmed email address (64-char hex string). ' ||
  'Prevents email exposure in database dumps.';

COMMENT ON COLUMN verification_codes.code_hash IS
  'SHA-256 hash of verification code + salt (32 bytes). ' ||
  'Codes never stored in plaintext for security.';

COMMENT ON COLUMN verification_codes.code_salt IS
  'Random 16-byte salt for code hash computation. ' ||
  'Unique per code to prevent rainbow table attacks.';

COMMENT ON COLUMN verification_codes.expires_at IS
  '5-minute expiry timestamp. Codes invalid after this time. ' ||
  'Enforced via WHERE expires_at > NOW() in validation queries.';

COMMENT ON FUNCTION cleanup_expired_codes() IS
  'Deletes expired verification codes. ' ||
  'Should be invoked every 5 minutes via pg_cron or edge function.';

-- ============================================================================
-- Optional: pg_cron Scheduling (uncomment if pg_cron extension available)
-- ============================================================================
-- Requires: CREATE EXTENSION pg_cron;
--
-- SELECT cron.schedule(
--   'cleanup-expired-verification-codes',
--   '*/5 * * * *',  -- Every 5 minutes
--   'SELECT cleanup_expired_codes();'
-- );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Table: verification_codes created with 7 columns
-- Indexes: 3 indexes created (email_hash, expires_at, correlation_id)
-- Function: cleanup_expired_codes() created for scheduled cleanup
-- Constraints: UNIQUE constraint on email_hash
-- ============================================================================
