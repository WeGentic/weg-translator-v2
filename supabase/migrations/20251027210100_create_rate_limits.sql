-- Migration: Create rate_limits table
-- Purpose: Implement bucketed sliding window rate limiting for cleanup operations
-- Author: Claude Code (registration-edge-case-fix Phase 1)
-- Date: 2025-10-27
-- Requirements: Req#3 (Cleanup Edge Function), Req#8 (Security), NFR-6 (Global rate limit), NFR-7 (Distributed support)

-- ============================================================================
-- rate_limits table
-- ============================================================================
-- This table implements a bucketed sliding window rate limiting algorithm
-- for orphaned user cleanup operations. The system tracks requests in
-- 1-second buckets and enforces three-tier rate limits:
--
-- Tier 1: Global (1000 req/60s) - Protects backend infrastructure
-- Tier 2: Per-IP (5 req/60s) - Prevents single-source abuse
-- Tier 3: Per-Email (3 req/3600s) - Prevents targeted attacks
--
-- Key Features:
-- - Atomic increment operations (no race conditions)
-- - Automatic cleanup of old buckets
-- - RFC 7231 compliant Retry-After calculation
-- - Distributed consistency across edge function instances
-- ============================================================================

CREATE TABLE rate_limits (
  -- Rate limit identifier
  -- Format:
  --   - Global: 'global'
  --   - Per-IP: 'ip:' + SHA256(ip_address) (64-char hex)
  --   - Per-Email: 'email:' + SHA256(email) (64-char hex)
  key TEXT NOT NULL,

  -- Bucket timestamp (truncated to second)
  -- Identifies the 1-second time bucket
  -- Example: '2025-10-28 12:00:45+00'
  bucket_time TIMESTAMPTZ NOT NULL,

  -- Request count in this bucket
  -- Typically 1-10 per bucket, incremented atomically
  count INTEGER NOT NULL DEFAULT 1,

  -- Composite primary key
  -- Ensures unique bucket per key, enables efficient lookups
  PRIMARY KEY (key, bucket_time)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Efficient window queries and cleanup
-- Used for: DELETE WHERE bucket_time < threshold
-- Expected: Index scan → batch delete, <10ms for 1000 rows
CREATE INDEX idx_rate_limits_bucket_time
  ON rate_limits(bucket_time);

-- Note: Composite index (key, bucket_time) is automatically created by PRIMARY KEY
-- Used for: WHERE key = ? AND bucket_time > ?

-- ============================================================================
-- Comments for Schema Documentation
-- ============================================================================

COMMENT ON TABLE rate_limits IS
  'Bucketed sliding window rate limiting for cleanup operations. ' ||
  'Stores request counts in 1-second buckets for three-tier rate limiting: ' ||
  'Global (1000/60s), Per-IP (5/60s), Per-Email (3/3600s).';

COMMENT ON COLUMN rate_limits.key IS
  'Rate limit identifier. Format: ''global'', ''ip:<sha256>'', ''email:<sha256>''. ' ||
  'IP and email hashes are 64-character hexadecimal strings.';

COMMENT ON COLUMN rate_limits.bucket_time IS
  'Bucket timestamp truncated to second (DATE_TRUNC(''second'', NOW())). ' ||
  'Used for sliding window calculations and automatic cleanup.';

COMMENT ON COLUMN rate_limits.count IS
  'Number of requests in this bucket. Incremented atomically via ON CONFLICT DO UPDATE.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Table: rate_limits created with 3 columns
-- Indexes: 1 index created (bucket_time) + PRIMARY KEY composite index
-- Constraints: PRIMARY KEY on (key, bucket_time)
-- ============================================================================
