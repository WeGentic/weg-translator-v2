/**
 * Unit tests for orphan detection utility
 *
 * Tests comprehensive orphan detection scenarios including:
 * - Orphaned users (Case 1.2) with no company/admin data
 * - Non-orphaned users with company or admin data
 * - Timeout handling (>500ms)
 * - Error handling with graceful degradation
 * - Correlation ID propagation
 *
 * Requirements: Req 3 (Enhanced Login Flow with Orphan Detection), Req 13 (Testing - 80% frontend coverage)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client - must be hoisted before imports
vi.mock('@/core/config/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { checkIfOrphaned } from './orphanDetection';
import type { OrphanCheckResult } from './orphanDetection';
import { supabase } from '@/core/config/supabaseClient';

describe('orphanDetection', () => {
  // Mock crypto.randomUUID for correlation IDs
  const mockRandomUUID = vi.fn(() => 'test-correlation-id-123');

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Date.now for consistent timing tests
    vi.useFakeTimers();
    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: mockRandomUUID,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('checkIfOrphaned', () => {
    it('should return isOrphaned=true when user has no company or admin data (Case 1.2)', async () => {
      const userId = 'user-orphaned-123';

      // Mock companies query - no data
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Mock company_admins query - no data
      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions
      expect(result.isOrphaned).toBe(true);
      expect(result.classification).toBe('case_1_2');
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.timedOut).toBe(false);
      expect(result.metrics?.hadError).toBe(false);

      // Verify queries were executed
      expect(supabase.from).toHaveBeenCalledWith('companies');
      expect(supabase.from).toHaveBeenCalledWith('company_admins');
      expect(mockCompaniesQuery.eq).toHaveBeenCalledWith('owner_admin_uuid', userId);
      expect(mockAdminsQuery.eq).toHaveBeenCalledWith('admin_uuid', userId);
    });

    it('should return isOrphaned=false when user has company data', async () => {
      const userId = 'user-with-company-123';

      // Mock companies query - has data
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'company-id-123' },
          error: null
        }),
      };

      // Mock company_admins query - no data (doesn't matter)
      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions
      expect(result.isOrphaned).toBe(false);
      expect(result.classification).toBe(null);
      expect(result.metrics).toBeDefined();
    });

    it('should return isOrphaned=false when user has admin data', async () => {
      const userId = 'user-admin-only-123';

      // Mock companies query - no data
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Mock company_admins query - has data
      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { admin_uuid: userId },
          error: null
        }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions
      expect(result.isOrphaned).toBe(false);
      expect(result.classification).toBe(null);
    });

    it('should handle timeout (>500ms) and return isOrphaned=false (graceful degradation)', async () => {
      const userId = 'user-timeout-test';

      // Mock slow queries that never resolve
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: null, error: null }), 600); // Exceeds 500ms timeout
          })
        ),
      };

      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: null, error: null }), 600);
          })
        ),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check with timer advancement
      const checkPromise = checkIfOrphaned(userId);

      // Advance timers to trigger timeout (500ms)
      await vi.advanceTimersByTimeAsync(500);

      const result: OrphanCheckResult = await checkPromise;

      // Assertions - graceful degradation returns false
      expect(result.isOrphaned).toBe(false);
      expect(result.classification).toBe(null);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.timedOut).toBe(true);
      expect(result.metrics?.totalDurationMs).toBeGreaterThanOrEqual(500);
    });

    it('should handle database query errors and return isOrphaned=false (graceful degradation)', async () => {
      const userId = 'user-error-test';
      const mockError = { message: 'Database connection failed', code: 'PGRST301' };

      // Mock companies query - error
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      // Mock company_admins query - won't be called due to early exit
      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions - graceful degradation returns false
      expect(result.isOrphaned).toBe(false);
      expect(result.classification).toBe(null);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.hadError).toBe(true);
    });

    it('should handle exception during query execution (graceful degradation)', async () => {
      const userId = 'user-exception-test';
      const mockException = new Error('Network connection lost');

      // Mock companies query - throws exception
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockRejectedValue(mockException),
      };

      vi.mocked(supabase.from).mockReturnValueOnce(mockCompaniesQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions - graceful degradation returns false
      expect(result.isOrphaned).toBe(false);
      expect(result.classification).toBe(null);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.hadError).toBe(true);
    });

    it('should include performance metrics in result', async () => {
      const userId = 'user-metrics-test';

      // Mock fast queries (< 100ms)
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions - metrics present
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.queryDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.correlationId).toBe('test-correlation-id-123');
      expect(result.metrics?.startedAt).toBeDefined();
      expect(result.metrics?.completedAt).toBeDefined();
      expect(result.metrics?.timedOut).toBe(false);
      expect(result.metrics?.hadError).toBe(false);

      // Verify correlation ID generation
      expect(mockRandomUUID).toHaveBeenCalled();
    });

    it('should propagate correlation ID through metrics', async () => {
      const userId = 'user-correlation-test';
      const expectedCorrelationId = 'test-correlation-id-123';

      // Mock queries
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result = await checkIfOrphaned(userId);

      // Verify correlation ID in metrics
      expect(result.metrics?.correlationId).toBe(expectedCorrelationId);
    });

    it('should return isOrphaned=false when both queries have data', async () => {
      const userId = 'user-full-data-123';

      // Mock companies query - has data
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'company-id-456' },
          error: null
        }),
      };

      // Mock company_admins query - has data
      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { admin_uuid: userId },
          error: null
        }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions
      expect(result.isOrphaned).toBe(false);
      expect(result.classification).toBe(null);
    });

    it('should handle PGRST116 error code (no rows) as expected for orphaned users', async () => {
      const userId = 'user-pgrst116-test';
      const pgrst116Error = {
        message: 'No rows returned',
        code: 'PGRST116',
        details: 'The result contains 0 rows'
      };

      // Mock companies query - PGRST116 (no rows)
      const mockCompaniesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: pgrst116Error }),
      };

      // Mock company_admins query - PGRST116 (no rows)
      const mockAdminsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: pgrst116Error }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockCompaniesQuery as any)
        .mockReturnValueOnce(mockAdminsQuery as any);

      // Execute check
      const result: OrphanCheckResult = await checkIfOrphaned(userId);

      // Assertions - PGRST116 treated as "no data" (expected for orphaned users)
      expect(result.isOrphaned).toBe(true);
      expect(result.classification).toBe('case_1_2');
    });
  });
});
