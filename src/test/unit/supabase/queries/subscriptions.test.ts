/**
 * Unit Tests for Subscription Queries
 *
 * Tests subscription status checking and trial expiry calculations.
 * Tests fail-closed enforcement pattern.
 * RLS policies are tested separately in integration tests.
 *
 * Requirements: FR-005, FR-008 (B2B Schema Query Helpers)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { SubscriptionQueries } from '@/core/supabase/queries/subscriptions';
import type { Subscription } from '@/shared/types/database';

// Mock Supabase client
vi.mock('@/core/config/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock error utilities
vi.mock('@/core/supabase/errors', () => ({
  generateCorrelationId: vi.fn(() => 'test-correlation-id'),
  logOperationError: vi.fn(),
  mapSupabaseError: vi.fn((error) => ({
    type: 'database',
    message: error.message || 'Database error',
    correlationId: 'test-correlation-id',
  })),
}));

import { supabase } from '@/core/config/supabaseClient';

describe('SubscriptionQueries', () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let isMock: ReturnType<typeof vi.fn>;
  let orderMock: ReturnType<typeof vi.fn>;
  let limitMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    maybeSingleMock = vi.fn();
    limitMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    orderMock = vi.fn(() => ({ limit: limitMock }));
    isMock = vi.fn(() => ({ order: orderMock }));
    eqMock = vi.fn(() => ({ is: isMock }));
    selectMock = vi.fn(() => ({ eq: eqMock }));
    fromMock = vi.fn(() => ({
      select: selectMock,
    }));

    (supabase.from as Mock) = fromMock;
  });

  describe('getAccountSubscription', () => {
    it('should fetch active subscription for account', async () => {
      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: '2025-02-15T00:00:00Z',
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.getAccountSubscription('account-123');

      expect(result).toEqual(mockSubscription);
      expect(fromMock).toHaveBeenCalledWith('subscriptions');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('account_uuid', 'account-123');
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(limitMock).toHaveBeenCalledWith(1);
    });

    it('should return null when no subscription found (fail-closed)', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await SubscriptionQueries.getAccountSubscription('account-123');

      expect(result).toBeNull();
    });

    it('should filter out soft-deleted subscriptions', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      await SubscriptionQueries.getAccountSubscription('account-123');

      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw error when database query fails', async () => {
      const dbError = { message: 'Database connection failed', code: '500' };
      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      await expect(SubscriptionQueries.getAccountSubscription('account-123')).rejects.toThrow();
    });
  });

  describe('checkTrialExpiry', () => {
    it('should calculate days remaining for active trial', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: futureDate.toISOString(),
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      const result = SubscriptionQueries.checkTrialExpiry(mockSubscription);

      expect(result).toBeTruthy();
      expect(result?.isTrialing).toBe(true);
      expect(result?.isExpired).toBe(false);
      expect(result?.daysRemaining).toBeGreaterThanOrEqual(9);
      expect(result?.daysRemaining).toBeLessThanOrEqual(10);
      expect(result?.trialEndsAt).toBe(futureDate.toISOString());
    });

    it('should detect expired trial', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: pastDate.toISOString(),
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      const result = SubscriptionQueries.checkTrialExpiry(mockSubscription);

      expect(result).toBeTruthy();
      expect(result?.isTrialing).toBe(true);
      expect(result?.isExpired).toBe(true);
      expect(result?.daysRemaining).toBe(0);
    });

    it('should return null for non-trialing subscription', () => {
      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'active',
        plan_id: 'pro',
        trial_ends_at: null,
        current_period_start: '2025-01-01T00:00:00Z',
        current_period_end: '2025-02-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      const result = SubscriptionQueries.checkTrialExpiry(mockSubscription);

      expect(result).toBeNull();
    });

    it('should handle trialing subscription without trial_ends_at', () => {
      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: null,
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      const result = SubscriptionQueries.checkTrialExpiry(mockSubscription);

      expect(result).toBeTruthy();
      expect(result?.isTrialing).toBe(true);
      expect(result?.daysRemaining).toBeNull();
      expect(result?.isExpired).toBe(false);
    });

    it('should never return negative days remaining', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 100);

      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: pastDate.toISOString(),
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      const result = SubscriptionQueries.checkTrialExpiry(mockSubscription);

      expect(result?.daysRemaining).toBe(0);
      expect(result?.isExpired).toBe(true);
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return true for active subscription', async () => {
      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'active',
        plan_id: 'pro',
        trial_ends_at: null,
        current_period_start: '2025-01-01T00:00:00Z',
        current_period_end: '2025-02-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.hasActiveSubscription('account-123');

      expect(result).toBe(true);
    });

    it('should return true for non-expired trial', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: futureDate.toISOString(),
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.hasActiveSubscription('account-123');

      expect(result).toBe(true);
    });

    it('should return false for expired trial (fail-closed)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: pastDate.toISOString(),
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.hasActiveSubscription('account-123');

      expect(result).toBe(false);
    });

    it('should return false when no subscription found (fail-closed)', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await SubscriptionQueries.hasActiveSubscription('account-123');

      expect(result).toBe(false);
    });

    it('should return false for past_due status (fail-closed)', async () => {
      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'past_due',
        plan_id: 'pro',
        trial_ends_at: null,
        current_period_start: '2025-01-01T00:00:00Z',
        current_period_end: '2025-02-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.hasActiveSubscription('account-123');

      expect(result).toBe(false);
    });

    it('should return false for canceled status (fail-closed)', async () => {
      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'canceled',
        plan_id: 'pro',
        trial_ends_at: null,
        current_period_start: '2025-01-01T00:00:00Z',
        current_period_end: '2025-02-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.hasActiveSubscription('account-123');

      expect(result).toBe(false);
    });

    it('should return false on database error (fail-closed)', async () => {
      const dbError = { message: 'Database error', code: '500' };
      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      const result = await SubscriptionQueries.hasActiveSubscription('account-123');

      expect(result).toBe(false);
    });
  });

  describe('getSubscriptionWithTrialStatus', () => {
    it('should return subscription with trial status', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'trialing',
        plan_id: 'trial',
        trial_ends_at: futureDate.toISOString(),
        current_period_start: null,
        current_period_end: null,
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.getSubscriptionWithTrialStatus('account-123');

      expect(result).toBeTruthy();
      expect(result?.subscription).toEqual(mockSubscription);
      expect(result?.trialStatus).toBeTruthy();
      expect(result?.trialStatus?.isTrialing).toBe(true);
      expect(result?.trialStatus?.isExpired).toBe(false);
    });

    it('should return null trial status for active subscription', async () => {
      const mockSubscription: Subscription = {
        subscription_uuid: 'sub-123',
        account_uuid: 'account-123',
        status: 'active',
        plan_id: 'pro',
        trial_ends_at: null,
        current_period_start: '2025-01-01T00:00:00Z',
        current_period_end: '2025-02-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await SubscriptionQueries.getSubscriptionWithTrialStatus('account-123');

      expect(result).toBeTruthy();
      expect(result?.subscription).toEqual(mockSubscription);
      expect(result?.trialStatus).toBeNull();
    });

    it('should return null when no subscription found (fail-closed)', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await SubscriptionQueries.getSubscriptionWithTrialStatus('account-123');

      expect(result).toBeNull();
    });
  });
});
