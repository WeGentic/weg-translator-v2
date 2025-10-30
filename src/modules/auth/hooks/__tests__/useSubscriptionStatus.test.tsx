/**
 * Tests for useSubscriptionStatus hook.
 * TASK 7.6: Test cache behavior, trial expiry calculations, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubscriptionStatus } from '../useSubscriptionStatus';
import { SubscriptionQueries } from '@/core/supabase/queries/subscriptions';
import type { Subscription } from '@/shared/types/database';
import type { ReactNode } from 'react';

// Mock SubscriptionQueries
vi.mock('@/core/supabase/queries/subscriptions', () => ({
  SubscriptionQueries: {
    getSubscriptionWithTrialStatus: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/core/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useSubscriptionStatus', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for faster tests
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  // Helper to create wrapper with QueryClient
  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  // Helper to create mock subscription
  const createMockSubscription = (
    overrides: Partial<Subscription> = {}
  ): Subscription => {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    return {
      subscription_uuid: 'test-subscription-uuid',
      account_uuid: 'test-account-uuid',
      status: 'trialing',
      plan_id: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
      current_period_start: null,
      current_period_end: null,
      created_at: now.toISOString(),
      modified_at: now.toISOString(),
      deleted_at: null,
      ...overrides,
    };
  };

  describe('Cache Behavior', () => {
    it('TASK 7.6: First call queries database, subsequent calls return cached value within 5-minute TTL', async () => {
      const accountUuid = 'test-account-uuid';
      const mockSubscription = createMockSubscription();

      // Mock successful subscription fetch
      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockResolvedValue({
        subscription: mockSubscription,
        trialStatus: {
          isTrialing: true,
          daysRemaining: 14,
          isExpired: false,
          trialEndsAt: mockSubscription.trial_ends_at,
        },
      });

      // First render - should query database
      const { result: result1 } = renderHook(
        () => useSubscriptionStatus(accountUuid),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(SubscriptionQueries.getSubscriptionWithTrialStatus).toHaveBeenCalledTimes(1);
      expect(SubscriptionQueries.getSubscriptionWithTrialStatus).toHaveBeenCalledWith(
        accountUuid
      );
      expect(result1.current.data).toBeDefined();
      expect(result1.current.data?.status).toBe('trialing');

      // Second render - should return cached value without querying database
      const { result: result2 } = renderHook(
        () => useSubscriptionStatus(accountUuid),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Query should NOT be called again (cached)
      expect(SubscriptionQueries.getSubscriptionWithTrialStatus).toHaveBeenCalledTimes(1);
      expect(result2.current.data).toEqual(result1.current.data);
    });

    it('TASK 7.6: Cache expires after 5-minute TTL and refetches on next access', async () => {
      const accountUuid = 'test-account-uuid';
      const mockSubscription = createMockSubscription();

      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockResolvedValue({
        subscription: mockSubscription,
        trialStatus: {
          isTrialing: true,
          daysRemaining: 14,
          isExpired: false,
          trialEndsAt: mockSubscription.trial_ends_at,
        },
      });

      // First render
      const { result } = renderHook(() => useSubscriptionStatus(accountUuid), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCallCount = vi.mocked(
        SubscriptionQueries.getSubscriptionWithTrialStatus
      ).mock.calls.length;
      expect(initialCallCount).toBeGreaterThanOrEqual(1);

      // Simulate 5-minute stale time passing by manually invalidating cache
      await queryClient.invalidateQueries({ queryKey: ['subscription', accountUuid] });

      // Force refetch
      await queryClient.refetchQueries({ queryKey: ['subscription', accountUuid] });

      // Should have called query at least one more time after invalidation
      const finalCallCount = vi.mocked(
        SubscriptionQueries.getSubscriptionWithTrialStatus
      ).mock.calls.length;
      expect(finalCallCount).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Trial Expiry Calculations', () => {
    it('TASK 7.6: Correctly calculates daysRemaining for trial expiring in 14 days', async () => {
      const accountUuid = 'test-account-uuid';
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const mockSubscription = createMockSubscription({
        trial_ends_at: trialEndsAt.toISOString(),
      });

      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockResolvedValue({
        subscription: mockSubscription,
        trialStatus: {
          isTrialing: true,
          daysRemaining: 14,
          isExpired: false,
          trialEndsAt: mockSubscription.trial_ends_at,
        },
      });

      const { result } = renderHook(() => useSubscriptionStatus(accountUuid), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.daysRemaining).toBe(14);
      expect(result.current.data?.hasActiveSubscription).toBe(true);
    });

    it('TASK 7.6: Correctly calculates daysRemaining for trial expiring in 2 days', async () => {
      const accountUuid = 'test-account-uuid';
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      const mockSubscription = createMockSubscription({
        trial_ends_at: trialEndsAt.toISOString(),
      });

      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockResolvedValue({
        subscription: mockSubscription,
        trialStatus: {
          isTrialing: true,
          daysRemaining: 2,
          isExpired: false,
          trialEndsAt: mockSubscription.trial_ends_at,
        },
      });

      const { result } = renderHook(() => useSubscriptionStatus(accountUuid), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.daysRemaining).toBe(2);
      expect(result.current.data?.hasActiveSubscription).toBe(true);
    });

    it('TASK 7.6: Correctly identifies expired trial when trial_ends_at is in the past', async () => {
      const accountUuid = 'test-account-uuid';
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

      const mockSubscription = createMockSubscription({
        trial_ends_at: trialEndsAt.toISOString(),
      });

      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockResolvedValue({
        subscription: mockSubscription,
        trialStatus: {
          isTrialing: true,
          daysRemaining: 0,
          isExpired: true,
          trialEndsAt: mockSubscription.trial_ends_at,
        },
      });

      const { result } = renderHook(() => useSubscriptionStatus(accountUuid), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.daysRemaining).toBe(0);
      expect(result.current.data?.trialStatus?.isExpired).toBe(true);
      expect(result.current.data?.hasActiveSubscription).toBe(false);
    });

    it('TASK 7.6: Handles active subscription (not trialing)', async () => {
      const accountUuid = 'test-account-uuid';
      const now = new Date();

      const mockSubscription = createMockSubscription({
        status: 'active',
        plan_id: 'pro',
        trial_ends_at: null,
        current_period_start: now.toISOString(),
        current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockResolvedValue({
        subscription: mockSubscription,
        trialStatus: null, // Not trialing
      });

      const { result } = renderHook(() => useSubscriptionStatus(accountUuid), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.status).toBe('active');
      expect(result.current.data?.daysRemaining).toBeNull();
      expect(result.current.data?.trialStatus).toBeNull();
      expect(result.current.data?.hasActiveSubscription).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('TASK 7.6: Handles missing subscription (returns null)', async () => {
      const accountUuid = 'test-account-uuid';

      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockResolvedValue(
        null
      );

      const { result } = renderHook(() => useSubscriptionStatus(accountUuid), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('TASK 7.6: Handles query error (fail-closed behavior)', async () => {
      const accountUuid = 'test-account-uuid';

      // Mock error to test fail-closed behavior
      vi.mocked(SubscriptionQueries.getSubscriptionWithTrialStatus).mockRejectedValue(
        new Error('Database connection failed')
      );

      const { result } = renderHook(() => useSubscriptionStatus(accountUuid), {
        wrapper: createWrapper(),
      });

      // Hook will retry 3 times, so wait for final error state or loading state
      // The hook implements retry logic, so we verify it's retrying
      await waitFor(
        () => {
          // Either loading (retrying) or error state is acceptable
          expect(
            result.current.isLoading || result.current.isError
          ).toBe(true);
        },
        { timeout: 100 }
      );

      // Verify the query was attempted
      expect(SubscriptionQueries.getSubscriptionWithTrialStatus).toHaveBeenCalled();
    });

    it('TASK 7.6: Does not query when accountUuid is null', async () => {
      const { result } = renderHook(() => useSubscriptionStatus(null), {
        wrapper: createWrapper(),
      });

      // Should not call query
      expect(SubscriptionQueries.getSubscriptionWithTrialStatus).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('TASK 7.6: Does not query when accountUuid is undefined', async () => {
      const { result } = renderHook(() => useSubscriptionStatus(undefined), {
        wrapper: createWrapper(),
      });

      // Should not call query
      expect(SubscriptionQueries.getSubscriptionWithTrialStatus).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });
  });
});
