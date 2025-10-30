/**
 * Type-safe query helpers for subscription status checking and management.
 * Uses Supabase client for direct cloud database access with RLS enforcement.
 * All queries filter by deleted_at IS NULL for soft delete pattern.
 * Implements fail-closed subscription enforcement.
 */

import { supabase } from '@/core/config/supabaseClient';
import type { Subscription } from '@/shared/types/database';
import {
  generateCorrelationId,
  logOperationError,
  mapSupabaseError,
  type UserFriendlyError,
} from '../errors';

/**
 * Trial status result with calculated days remaining.
 */
export interface TrialStatus {
  /** Whether the account is currently in trial period */
  isTrialing: boolean;
  /** Days remaining in trial, null if not trialing */
  daysRemaining: number | null;
  /** Whether the trial has expired */
  isExpired: boolean;
  /** Trial end date, null if not trialing */
  trialEndsAt: string | null;
}

/**
 * Static methods for subscription database operations.
 * All methods use authenticated Supabase client with RLS policy enforcement.
 * Soft delete pattern: All queries filter deleted_at IS NULL.
 * Fail-closed enforcement: Missing/failed queries should block premium features.
 */
export class SubscriptionQueries {
  /**
   * Fetch active subscription for an account.
   * Returns the most recent non-deleted subscription for the account.
   * RLS: User must be in the account to view subscription.
   * Filters out soft-deleted subscriptions (deleted_at IS NULL).
   *
   * @param accountUuid - UUID of the account
   * @returns Active subscription record or null if not found
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const subscription = await SubscriptionQueries.getAccountSubscription('123e4567-e89b-12d3-a456-426614174000');
   * if (subscription) {
   *   console.log('Status:', subscription.status, 'Plan:', subscription.plan_id);
   * } else {
   *   console.log('No active subscription found - blocking premium features');
   * }
   * ```
   */
  static async getAccountSubscription(
    accountUuid: string
  ): Promise<Subscription | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('account_uuid', accountUuid)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('getAccountSubscription', userError, { accountUuid });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getAccountSubscription', userError, { accountUuid });
      throw userError;
    }
  }

  /**
   * Check trial expiry and calculate days remaining.
   * Calculates trial status based on subscription.trial_ends_at timestamp.
   * Returns null if subscription is not in trial status.
   *
   * @param subscription - Subscription record to check
   * @returns Trial status with days remaining or null if not trialing
   *
   * @example
   * ```typescript
   * const subscription = await SubscriptionQueries.getAccountSubscription(accountUuid);
   * if (subscription) {
   *   const trialStatus = SubscriptionQueries.checkTrialExpiry(subscription);
   *   if (trialStatus?.isTrialing && !trialStatus.isExpired) {
   *     console.log(`Trial expires in ${trialStatus.daysRemaining} days`);
   *   } else if (trialStatus?.isExpired) {
   *     console.log('Trial has expired');
   *   }
   * }
   * ```
   */
  static checkTrialExpiry(subscription: Subscription): TrialStatus | null {
    // Return null if not in trial status
    if (subscription.status !== 'trialing') {
      return null;
    }

    // Return null if trial_ends_at is not set
    if (!subscription.trial_ends_at) {
      return {
        isTrialing: true,
        daysRemaining: null,
        isExpired: false,
        trialEndsAt: null,
      };
    }

    const now = new Date();
    const trialEnd = new Date(subscription.trial_ends_at);
    const timeDiff = trialEnd.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    return {
      isTrialing: true,
      daysRemaining: Math.max(0, daysRemaining), // Never return negative days
      isExpired: daysRemaining <= 0,
      trialEndsAt: subscription.trial_ends_at,
    };
  }

  /**
   * Check if account has active subscription (not expired, not canceled).
   * Returns true only for 'trialing' or 'active' status with non-expired trial.
   * Fail-closed: Returns false if subscription not found or query fails.
   *
   * @param accountUuid - UUID of the account
   * @returns True if account has valid active subscription, false otherwise
   *
   * @example
   * ```typescript
   * const hasAccess = await SubscriptionQueries.hasActiveSubscription(accountUuid);
   * if (!hasAccess) {
   *   console.log('Blocking premium features - no active subscription');
   *   return;
   * }
   * ```
   */
  static async hasActiveSubscription(accountUuid: string): Promise<boolean> {
    try {
      const subscription =
        await SubscriptionQueries.getAccountSubscription(accountUuid);

      if (!subscription) {
        return false; // Fail-closed: no subscription = no access
      }

      // Check if status is active
      if (subscription.status === 'active') {
        return true;
      }

      // Check if trialing and not expired
      if (subscription.status === 'trialing') {
        const trialStatus = SubscriptionQueries.checkTrialExpiry(subscription);
        return trialStatus ? !trialStatus.isExpired : false;
      }

      // All other statuses (past_due, canceled, unpaid) = no access
      return false;
    } catch (error) {
      // Fail-closed: query error = no access
      const correlationId = generateCorrelationId();
      const userError = mapSupabaseError(error, correlationId);
      logOperationError('hasActiveSubscription', userError, { accountUuid });
      return false;
    }
  }

  /**
   * Get subscription with trial status in a single call.
   * Convenience method that combines getAccountSubscription and checkTrialExpiry.
   * Returns null if no subscription found (fail-closed).
   *
   * @param accountUuid - UUID of the account
   * @returns Object with subscription and trial status, or null if not found
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const result = await SubscriptionQueries.getSubscriptionWithTrialStatus(accountUuid);
   * if (result) {
   *   console.log('Plan:', result.subscription.plan_id);
   *   if (result.trialStatus?.isTrialing) {
   *     console.log('Trial days remaining:', result.trialStatus.daysRemaining);
   *   }
   * }
   * ```
   */
  static async getSubscriptionWithTrialStatus(
    accountUuid: string
  ): Promise<{
    subscription: Subscription;
    trialStatus: TrialStatus | null;
  } | null> {
    const subscription =
      await SubscriptionQueries.getAccountSubscription(accountUuid);

    if (!subscription) {
      return null; // Fail-closed
    }

    const trialStatus = SubscriptionQueries.checkTrialExpiry(subscription);

    return {
      subscription,
      trialStatus,
    };
  }
}
