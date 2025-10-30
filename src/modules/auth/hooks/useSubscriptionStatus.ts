/**
 * React Query hook for subscription status with 5-minute caching.
 * Implements fail-closed policy: treats missing/failed queries as no active subscription.
 * Caches subscription status in memory to reduce database load.
 */

import { useQuery } from '@tanstack/react-query';
import { SubscriptionQueries, type TrialStatus } from '@/core/supabase/queries/subscriptions';
import type { Subscription } from '@/shared/types/database';
import { logger } from '@/core/logging';

/**
 * Subscription status with computed daysRemaining field.
 * Null if no subscription found (fail-closed).
 */
export interface SubscriptionStatusResult {
  /** The subscription record */
  subscription: Subscription;
  /** Current subscription status */
  status: Subscription['status'];
  /** Trial expiration timestamp */
  trial_ends_at: string | null;
  /** Computed days remaining in trial (null if not trialing) */
  daysRemaining: number | null;
  /** Whether the subscription is currently active (trialing or active status with non-expired trial) */
  hasActiveSubscription: boolean;
  /** Trial status details (null if not trialing) */
  trialStatus: TrialStatus | null;
}

/**
 * Hook for fetching subscription status with react-query caching.
 * Uses 5-minute staleTime to reduce database queries.
 * Caches by accountUuid key for proper invalidation.
 *
 * @param accountUuid - UUID of the account to fetch subscription for
 * @returns React Query result with subscription status and computed fields
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user } = useAuth();
 *   const { data: subscriptionStatus, isLoading, error } = useSubscriptionStatus(user?.accountUuid);
 *
 *   if (isLoading) return <div>Loading subscription status...</div>;
 *   if (error) return <div>Unable to load subscription status</div>;
 *   if (!subscriptionStatus) return <div>No active subscription</div>;
 *
 *   return (
 *     <div>
 *       <p>Status: {subscriptionStatus.status}</p>
 *       {subscriptionStatus.daysRemaining !== null && (
 *         <p>Trial expires in {subscriptionStatus.daysRemaining} days</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSubscriptionStatus(accountUuid: string | null | undefined) {
  return useQuery({
    // Query key includes accountUuid for proper cache invalidation
    queryKey: ['subscription', accountUuid],

    // Fetch function calling SubscriptionQueries.getAccountSubscription
    queryFn: async (): Promise<SubscriptionStatusResult | null> => {
      if (!accountUuid) {
        void logger.warn('useSubscriptionStatus called without accountUuid', {
          accountUuid,
        });
        return null; // Fail-closed: no accountUuid = no subscription
      }

      const correlationId = crypto.randomUUID();

      try {
        // Fetch subscription with trial status
        const result = await SubscriptionQueries.getSubscriptionWithTrialStatus(accountUuid);

        if (!result) {
          void logger.info('No subscription found for account', {
            accountUuid,
            correlationId,
          });
          return null; // Fail-closed: no subscription = no access
        }

        const { subscription, trialStatus } = result;

        // Compute hasActiveSubscription based on status and trial expiry
        let hasActiveSubscription = false;
        if (subscription.status === 'active') {
          hasActiveSubscription = true;
        } else if (subscription.status === 'trialing') {
          hasActiveSubscription = trialStatus ? !trialStatus.isExpired : false;
        }
        // All other statuses (past_due, canceled, unpaid) = no access

        void logger.info('Subscription status fetched successfully', {
          accountUuid,
          correlationId,
          status: subscription.status,
          hasActiveSubscription,
          isTrialing: trialStatus?.isTrialing ?? false,
          daysRemaining: trialStatus?.daysRemaining ?? null,
        });

        return {
          subscription,
          status: subscription.status,
          trial_ends_at: subscription.trial_ends_at,
          daysRemaining: trialStatus?.daysRemaining ?? null,
          hasActiveSubscription,
          trialStatus,
        };
      } catch (error) {
        // Log error but allow react-query error handling to propagate
        void logger.error('Failed to fetch subscription status', {
          accountUuid,
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Let react-query handle retry logic
      }
    },

    // Only enable query if accountUuid is provided
    enabled: Boolean(accountUuid),

    // Cache configuration: 5-minute stale time and cache time
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection time (formerly cacheTime)

    // Retry configuration: 3 retries with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch configuration: refetch on window focus to ensure fresh data
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,

    // Fail-closed: treat errors as no subscription (handled by consuming components)
    // Components should check for error state and treat as no access
  });
}
