/**
 * Utility functions for invalidating subscription status cache.
 * Provides programmatic cache invalidation when subscription status changes.
 */

import { queryClient } from '@/app/providers/QueryProvider';
import { logger } from '@/core/logging';

/**
 * Invalidates subscription status cache for a specific account.
 * Call this when user upgrades subscription or subscription status changes.
 *
 * TASK 7.5: Invalidate react-query cache when user upgrades subscription
 * queryClient.invalidateQueries(['subscription', accountUuid])
 *
 * @param accountUuid - UUID of the account whose subscription changed
 *
 * @example
 * ```typescript
 * // After successful subscription upgrade:
 * await invalidateSubscriptionCache(accountUuid);
 *
 * // Subscription status will be refetched on next access
 * ```
 */
export async function invalidateSubscriptionCache(accountUuid: string): Promise<void> {
  const correlationId = crypto.randomUUID();

  try {
    void logger.info('Invalidating subscription cache', {
      accountUuid,
      correlationId,
    });

    // TASK 7.5: Invalidate cache when subscription status changes
    await queryClient.invalidateQueries({
      queryKey: ['subscription', accountUuid],
    });

    void logger.info('Subscription cache invalidated successfully', {
      accountUuid,
      correlationId,
    });
  } catch (error) {
    void logger.error('Failed to invalidate subscription cache', {
      accountUuid,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - cache invalidation failure should not block user flow
  }
}

/**
 * Invalidates all subscription caches across all accounts.
 * Use sparingly - typically only needed for system-wide subscription changes.
 *
 * @example
 * ```typescript
 * // After system-wide subscription policy change:
 * await invalidateAllSubscriptionCaches();
 * ```
 */
export async function invalidateAllSubscriptionCaches(): Promise<void> {
  const correlationId = crypto.randomUUID();

  try {
    void logger.info('Invalidating all subscription caches', {
      correlationId,
    });

    // Invalidate all queries with 'subscription' key
    await queryClient.invalidateQueries({
      queryKey: ['subscription'],
    });

    void logger.info('All subscription caches invalidated successfully', {
      correlationId,
    });
  } catch (error) {
    void logger.error('Failed to invalidate all subscription caches', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - cache invalidation failure should not block user flow
  }
}

/**
 * Refetches subscription status immediately without waiting for cache expiry.
 * Use when immediate subscription status update is required (e.g., after upgrade).
 *
 * TASK 7.5: Implement cache refetch on subscription management page
 * to ensure immediate updates after upgrade
 *
 * @param accountUuid - UUID of the account to refetch subscription for
 *
 * @example
 * ```typescript
 * // On subscription management page after upgrade:
 * const updatedStatus = await refetchSubscriptionStatus(accountUuid);
 * if (updatedStatus?.hasActiveSubscription) {
 *   console.log('Upgrade successful!');
 * }
 * ```
 */
export async function refetchSubscriptionStatus(accountUuid: string): Promise<void> {
  const correlationId = crypto.randomUUID();

  try {
    void logger.info('Refetching subscription status', {
      accountUuid,
      correlationId,
    });

    // Refetch the query immediately
    await queryClient.refetchQueries({
      queryKey: ['subscription', accountUuid],
    });

    void logger.info('Subscription status refetched successfully', {
      accountUuid,
      correlationId,
    });
  } catch (error) {
    void logger.error('Failed to refetch subscription status', {
      accountUuid,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - refetch failure should not block user flow
  }
}

/**
 * Sets subscription data in cache programmatically.
 * Useful for optimistic updates after subscription changes.
 *
 * @param accountUuid - UUID of the account
 * @param subscriptionData - New subscription data to cache
 *
 * @example
 * ```typescript
 * // Optimistic update after upgrade initiation:
 * setSubscriptionCache(accountUuid, {
 *   ...currentSubscription,
 *   status: 'active',
 *   plan_id: 'pro',
 * });
 * ```
 */
export function setSubscriptionCache(accountUuid: string, subscriptionData: unknown): void {
  const correlationId = crypto.randomUUID();

  try {
    void logger.info('Setting subscription cache optimistically', {
      accountUuid,
      correlationId,
    });

    queryClient.setQueryData(['subscription', accountUuid], subscriptionData);

    void logger.info('Subscription cache set successfully', {
      accountUuid,
      correlationId,
    });
  } catch (error) {
    void logger.error('Failed to set subscription cache', {
      accountUuid,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - cache set failure should not block user flow
  }
}
