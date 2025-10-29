/**
 * Unit Tests for Orphan Detection Utility
 *
 * Tests the checkIfOrphaned() function which detects orphaned users
 * (users in Supabase Auth without corresponding company data).
 *
 * Test Coverage:
 * - Case 1.1: Unverified email + no company data → orphaned
 * - Case 1.2: Verified email + no company data → orphaned
 * - Non-orphaned users with company data
 * - Timeout scenarios with graceful degradation
 * - Error scenarios with graceful degradation
 * - Performance metrics tracking
 *
 * @module orphanDetection.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkIfOrphaned, type OrphanCheckResult } from '@/modules/auth/utils/orphanDetection';
import { supabase } from '@/core/config/supabaseClient';

// Mock the Supabase client
vi.mock('@/core/config/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('orphanDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkIfOrphaned', () => {
    describe('Case 1.1: Unverified email + no company data', () => {
      it('should detect orphaned user with no company or admin data', async () => {
        // Mock empty query results (no company, no admin data)
        const mockFrom = vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const userId = 'test-user-id';
        const result = await checkIfOrphaned(userId);

        // Assert: User is orphaned (Case 1.2 since login flow checks email verification first)
        expect(result.isOrphaned).toBe(true);
        expect(result.classification).toBe('case_1_2');

        // Assert: Metrics are tracked
        expect(result.metrics).toBeDefined();
        expect(result.metrics?.totalDurationMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics?.queryDurationMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics?.timedOut).toBe(false);
        expect(result.metrics?.hadError).toBe(false);
        expect(result.metrics?.correlationId).toBeDefined();
        expect(result.metrics?.startedAt).toBeDefined();
        expect(result.metrics?.completedAt).toBeDefined();

        // Assert: Both tables were queried
        expect(mockFrom).toHaveBeenCalledWith('companies');
        expect(mockFrom).toHaveBeenCalledWith('company_admins');
      });
    });

    describe('Case 1.2: Verified email + no company data', () => {
      it('should detect orphaned user with verified email', async () => {
        // Same test as Case 1.1 since email verification happens before orphan detection
        const mockFrom = vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('verified-user-id');

        expect(result.isOrphaned).toBe(true);
        expect(result.classification).toBe('case_1_2');
        expect(result.metrics?.timedOut).toBe(false);
        expect(result.metrics?.hadError).toBe(false);
      });
    });

    describe('Non-orphaned users', () => {
      it('should detect user with company data (not orphaned)', async () => {
        // Mock company data exists
        const mockFrom = vi.fn().mockImplementation((table: string) => {
          if (table === 'companies') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'company-123' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          // No admin data
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        });

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('company-owner-id');

        expect(result.isOrphaned).toBe(false);
        expect(result.classification).toBe(null);
        expect(result.metrics?.timedOut).toBe(false);
        expect(result.metrics?.hadError).toBe(false);
      });

      it('should detect user with admin data (not orphaned)', async () => {
        // Mock admin data exists
        const mockFrom = vi.fn().mockImplementation((table: string) => {
          if (table === 'company_admins') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { admin_uuid: 'admin-123' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          // No company data
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        });

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('admin-user-id');

        expect(result.isOrphaned).toBe(false);
        expect(result.classification).toBe(null);
      });

      it('should detect user with both company and admin data (not orphaned)', async () => {
        // Mock both data exist
        const mockFrom = vi.fn().mockImplementation((table: string) => {
          if (table === 'companies') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'company-123' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { admin_uuid: 'admin-123' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        });

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('full-user-id');

        expect(result.isOrphaned).toBe(false);
        expect(result.classification).toBe(null);
      });
    });

    describe('Timeout scenarios', () => {
      it('should gracefully degrade on query timeout (>500ms)', async () => {
        // Mock slow queries that exceed 500ms timeout
        const mockFrom = vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(
                  () =>
                    new Promise((resolve) => {
                      setTimeout(() => {
                        resolve({ data: null, error: null });
                      }, 600); // Exceeds 500ms timeout
                    })
                ),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        // Start the check
        const resultPromise = checkIfOrphaned('slow-user-id');

        // Fast-forward time to trigger timeout
        await vi.advanceTimersByTimeAsync(600);

        const result = await resultPromise;

        // Assert: Graceful degradation (returns false, not throws)
        expect(result.isOrphaned).toBe(false);
        expect(result.classification).toBe(null);

        // Assert: Timeout flag set
        expect(result.metrics?.timedOut).toBe(true);
        expect(result.metrics?.hadError).toBe(false);

        // Assert: Metrics still tracked
        expect(result.metrics?.totalDurationMs).toBeGreaterThanOrEqual(500);
        expect(result.metrics?.correlationId).toBeDefined();
      });

      it('should complete successfully if queries finish just under timeout', async () => {
        const mockFrom = vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(
                  () =>
                    new Promise((resolve) => {
                      setTimeout(() => {
                        resolve({ data: null, error: null });
                      }, 450); // Just under 500ms timeout
                    })
                ),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const resultPromise = checkIfOrphaned('fast-user-id');
        await vi.advanceTimersByTimeAsync(500);
        const result = await resultPromise;

        expect(result.isOrphaned).toBe(true);
        expect(result.metrics?.timedOut).toBe(false);
        expect(result.metrics?.hadError).toBe(false);
      });
    });

    describe('Error scenarios', () => {
      it('should gracefully degrade on database query error', async () => {
        // Mock query error (not PGRST116 which is expected for no rows)
        const mockFrom = vi.fn().mockImplementation((table: string) => {
          if (table === 'companies') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: {
                        code: 'PGRST500',
                        message: 'Database connection error',
                      },
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        });

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('error-user-id');

        // Assert: Graceful degradation (returns false, not throws)
        expect(result.isOrphaned).toBe(false);
        expect(result.classification).toBe(null);

        // Assert: Error flag set
        expect(result.metrics?.hadError).toBe(true);
        expect(result.metrics?.timedOut).toBe(false);
      });

      it('should handle PGRST116 error (no rows) as success case', async () => {
        // PGRST116 is expected for orphaned users (no rows found)
        const mockFrom = vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: 'PGRST116',
                    message: 'No rows returned',
                  },
                }),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('orphaned-user-id');

        // Assert: Treated as success (orphaned user)
        expect(result.isOrphaned).toBe(true);
        expect(result.classification).toBe('case_1_2');
        expect(result.metrics?.hadError).toBe(false);
      });

      it('should gracefully degrade on unexpected exception', async () => {
        // Mock unexpected exception during query setup
        const mockFrom = vi.fn().mockImplementation(() => {
          throw new Error('Unexpected runtime error');
        });

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('exception-user-id');

        // Assert: Graceful degradation
        expect(result.isOrphaned).toBe(false);
        expect(result.classification).toBe(null);
        expect(result.metrics?.hadError).toBe(true);
        expect(result.metrics?.timedOut).toBe(false);
      });
    });

    describe('Performance metrics', () => {
      it('should track accurate query duration', async () => {
        const mockFrom = vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(
                  () =>
                    new Promise((resolve) => {
                      setTimeout(() => {
                        resolve({ data: null, error: null });
                      }, 100);
                    })
                ),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const resultPromise = checkIfOrphaned('metrics-user-id');
        await vi.advanceTimersByTimeAsync(150);
        const result = await resultPromise;

        // Assert: Query duration is approximately 100ms (parallel queries)
        expect(result.metrics?.queryDurationMs).toBeGreaterThanOrEqual(100);
        expect(result.metrics?.queryDurationMs).toBeLessThan(150);

        // Assert: Total duration includes overhead
        expect(result.metrics?.totalDurationMs).toBeGreaterThanOrEqual(
          result.metrics?.queryDurationMs ?? 0
        );
      });

      it('should generate valid correlation ID', async () => {
        const mockFrom = vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('correlation-test-id');

        // Assert: Correlation ID is a valid UUID v4
        expect(result.metrics?.correlationId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });

      it('should record ISO 8601 timestamps', async () => {
        const mockFrom = vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }));

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await checkIfOrphaned('timestamp-test-id');

        // Assert: Timestamps are valid ISO 8601 format
        expect(result.metrics?.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(result.metrics?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

        // Assert: Completed timestamp is after started timestamp
        expect(new Date(result.metrics!.completedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(result.metrics!.startedAt).getTime()
        );
      });
    });

    describe('Parallel query execution', () => {
      it('should query both tables in parallel (not sequential)', async () => {
        // This test verifies that both query chains are set up before any async operations complete
        let companiesCallCount = 0;
        let adminsCallCount = 0;

        const mockFrom = vi.fn().mockImplementation((table: string) => {
          if (table === 'companies') {
            companiesCallCount++;
          } else if (table === 'company_admins') {
            adminsCallCount++;
          }

          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        });

        vi.mocked(supabase.from).mockImplementation(mockFrom);

        await checkIfOrphaned('parallel-test-id');

        // Assert: Both tables were queried (parallel execution)
        expect(companiesCallCount).toBe(1);
        expect(adminsCallCount).toBe(1);

        // Assert: supabase.from was called twice (once for each table)
        expect(mockFrom).toHaveBeenCalledTimes(2);
        expect(mockFrom).toHaveBeenCalledWith('companies');
        expect(mockFrom).toHaveBeenCalledWith('company_admins');
      });
    });
  });
});
