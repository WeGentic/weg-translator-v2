/**
 * Unit tests for orphan detection with B2B schema (single users table).
 * Tests all orphan classification scenarios and retry logic.
 *
 * @module orphanDetection.b2b.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkIfOrphaned, type OrphanCheckResult, type OrphanType } from './orphanDetection';
import { OrphanDetectionError } from '@/modules/auth/errors';
import { supabase } from '@/core/config/supabaseClient';

// Mock Supabase client
vi.mock('@/core/config/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('orphanDetection (B2B Schema)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Orphan Classification', () => {
    it('should classify as no-users-record when users query returns null', async () => {
      // Mock users table query returning no record
      const mockFrom = vi.fn().mockReturnValue({
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
      });
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.orphaned).toBe(true);
      expect(result.orphanType).toBe('no-users-record');
      expect(result.hasValidAccount).toBe(false);
      expect(result.accountUuid).toBeNull();
      expect(result.role).toBeNull();
      expect(result.metrics.attemptCount).toBe(1);
      expect(result.metrics.timedOut).toBe(false);
      expect(result.metrics.hadError).toBe(false);
    });

    it('should classify as null-account-uuid when account_uuid is null', async () => {
      // Mock users table query returning user with null account_uuid
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  user_uuid: 'test-user-id',
                  account_uuid: null,
                  role: 'member',
                  deleted_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      });
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.orphaned).toBe(true);
      expect(result.orphanType).toBe('null-account-uuid');
      expect(result.hasValidAccount).toBe(false);
      expect(result.accountUuid).toBeNull();
      expect(result.role).toBe('member');
      expect(result.metrics.attemptCount).toBe(1);
    });

    it('should classify as deleted-user when deleted_at is not null', async () => {
      // Mock users table query returning soft-deleted user
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  user_uuid: 'test-user-id',
                  account_uuid: 'test-account-id',
                  role: 'admin',
                  deleted_at: '2025-01-15T10:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        }),
      });
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.orphaned).toBe(true);
      expect(result.orphanType).toBe('deleted-user');
      expect(result.hasValidAccount).toBe(false);
      expect(result.accountUuid).toBe('test-account-id');
      expect(result.role).toBe('admin');
      expect(result.metrics.attemptCount).toBe(1);
    });

    it('should classify as deleted-account when account is deleted', async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation((tableName: string) => {
        callCount++;

        // First call: users table - return valid user
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      user_uuid: 'test-user-id',
                      account_uuid: 'test-account-id',
                      role: 'owner',
                      deleted_at: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        // Second call: accounts table - return deleted account
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    deleted_at: '2025-01-15T12:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.orphaned).toBe(true);
      expect(result.orphanType).toBe('deleted-account');
      expect(result.hasValidAccount).toBe(false);
      expect(result.accountUuid).toBe('test-account-id');
      expect(result.role).toBe('owner');
      expect(result.metrics.attemptCount).toBe(1);
      expect(callCount).toBe(2); // Verify both queries executed
    });

    it('should classify as deleted-account when account does not exist', async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation((tableName: string) => {
        callCount++;

        // First call: users table - return valid user
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      user_uuid: 'test-user-id',
                      account_uuid: 'test-account-id',
                      role: 'owner',
                      deleted_at: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        // Second call: accounts table - return null (account doesn't exist)
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
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.orphaned).toBe(true);
      expect(result.orphanType).toBe('deleted-account');
      expect(result.hasValidAccount).toBe(false);
    });

    it('should return hasValidAccount true when user and account are both valid', async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation((tableName: string) => {
        callCount++;

        // First call: users table - return valid user
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      user_uuid: 'test-user-id',
                      account_uuid: 'test-account-id',
                      role: 'admin',
                      deleted_at: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        // Second call: accounts table - return valid account
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    deleted_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.orphaned).toBe(false);
      expect(result.hasValidAccount).toBe(true);
      expect(result.orphanType).toBeNull();
      expect(result.accountUuid).toBe('test-account-id');
      expect(result.role).toBe('admin');
      expect(result.metrics.attemptCount).toBe(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on timeout with Gaussian jitter backoff', async () => {
      let usersAttemptCount = 0;
      const mockFrom = vi.fn().mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          usersAttemptCount++;

          // First attempt: timeout
          if (usersAttemptCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockImplementation(() => {
                      return new Promise((resolve) => {
                        setTimeout(() => {
                          resolve({
                            data: null,
                            error: null,
                          });
                        }, 300); // Timeout after 200ms
                      });
                    }),
                  }),
                }),
              }),
            };
          }

          // Second attempt: success - return orphaned user (no account)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // No users record = orphaned
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        // Should not reach accounts table in this test
        throw new Error('Unexpected accounts table query');
      });
      (supabase.from as any) = mockFrom;

      // Create promise that will resolve when checkIfOrphaned completes
      const checkPromise = checkIfOrphaned('test-user-id');

      // Advance timers to trigger timeout on first attempt
      await vi.advanceTimersByTimeAsync(250);

      // Advance timers through Gaussian jitter backoff (should be ~100ms ±50ms)
      await vi.advanceTimersByTimeAsync(200);

      const result = await checkPromise;

      expect(usersAttemptCount).toBe(2);
      expect(result.metrics.attemptCount).toBe(2);
      expect(result.orphaned).toBe(true);
      expect(result.orphanType).toBe('no-users-record');
    });

    it('should throw OrphanDetectionError after all retries exhausted', async () => {
      const mockFrom = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => {
                return new Promise((resolve) => {
                  setTimeout(() => {
                    resolve({
                      data: null,
                      error: null,
                    });
                  }, 300); // Always timeout
                });
              }),
            }),
          }),
        }),
      }));
      (supabase.from as any) = mockFrom;

      const checkPromise = checkIfOrphaned('test-user-id');

      // Advance through all 3 attempts with timeouts and backoffs
      await vi.advanceTimersByTimeAsync(250); // First attempt timeout
      await vi.advanceTimersByTimeAsync(200); // First backoff (~100ms)
      await vi.advanceTimersByTimeAsync(250); // Second attempt timeout
      await vi.advanceTimersByTimeAsync(400); // Second backoff (~300ms)
      await vi.advanceTimersByTimeAsync(250); // Third attempt timeout

      // Verify the promise rejects with OrphanDetectionError
      await expect(checkPromise).rejects.toThrow(OrphanDetectionError);
      await expect(checkPromise).rejects.toThrow('Orphan detection failed after all retry attempts');

      // Verify error properties
      await checkPromise.catch((error) => {
        expect(error).toBeInstanceOf(OrphanDetectionError);
        const orphanError = error as OrphanDetectionError;
        expect(orphanError.metrics.attemptCount).toBe(3);
        expect(orphanError.metrics.timedOut).toBe(true);
        expect(orphanError.correlationId).toBeDefined();
      });
    });

    it('should retry on query error with backoff', async () => {
      let usersCallCount = 0;
      const mockFrom = vi.fn().mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          usersCallCount++;

          // First attempt: database error
          if (usersCallCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Database connection error', code: 'PGRST000' },
                    }),
                  }),
                }),
              }),
            };
          }

          // Second attempt: success - return valid user
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      user_uuid: 'test-user-id',
                      account_uuid: 'test-account-id',
                      role: 'viewer',
                      deleted_at: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        // accounts table query - return valid account
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    deleted_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const checkPromise = checkIfOrphaned('test-user-id');

      // Advance timers through Gaussian jitter backoff
      await vi.advanceTimersByTimeAsync(200);

      const result = await checkPromise;

      expect(usersCallCount).toBe(2);
      expect(result.metrics.attemptCount).toBe(2);
      expect(result.hasValidAccount).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete within 200ms timeout for single query', async () => {
      const mockFrom = vi.fn().mockReturnValue({
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
      });
      (supabase.from as any) = mockFrom;

      const startTime = performance.now();
      const result = await checkIfOrphaned('test-user-id');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(200);
      expect(result.metrics.totalDurationMs).toBeLessThan(200);
    });

    it('should warn when detection exceeds p95 target of 200ms', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockFrom = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => {
                return new Promise((resolve) => {
                  setTimeout(() => {
                    resolve({
                      data: null,
                      error: null,
                    });
                  }, 250); // Slow query
                });
              }),
            }),
          }),
        }),
      }));
      (supabase.from as any) = mockFrom;

      const checkPromise = checkIfOrphaned('test-user-id', { timeoutMs: 300 });
      await vi.advanceTimersByTimeAsync(300);
      await checkPromise;

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[orphanDetection] Orphan detection exceeded p95 target'),
        expect.objectContaining({
          target: 200,
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should treat PGRST116 (no rows) as success, not error', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' },
              }),
            }),
          }),
        }),
      });
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.orphaned).toBe(true);
      expect(result.orphanType).toBe('no-users-record');
      expect(result.metrics.attemptCount).toBe(1);
      expect(result.metrics.hadError).toBe(false);
    });

    it('should include correlationId in metrics for all results', async () => {
      const mockFrom = vi.fn().mockReturnValue({
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
      });
      (supabase.from as any) = mockFrom;

      const result = await checkIfOrphaned('test-user-id');

      expect(result.metrics.correlationId).toBeDefined();
      expect(typeof result.metrics.correlationId).toBe('string');
      expect(result.metrics.correlationId.length).toBeGreaterThan(0);
    });
  });
});
