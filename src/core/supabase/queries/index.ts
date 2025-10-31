/**
 * Centralized exports for all Supabase query modules.
 * Provides clean imports for company, profile, membership, and B2B account operations.
 *
 * @example
 * ```typescript
 * // Legacy queries (deprecated)
 * import { CompanyQueries, ProfileQueries, MembershipQueries } from '@/core/supabase/queries';
 *
 * // B2B Schema queries (recommended)
 * import { AccountQueries, UserQueries, SubscriptionQueries } from '@/core/supabase/queries';
 *
 * // Use query helpers
 * const accounts = await AccountQueries.listUserAccounts();
 * const user = await UserQueries.getCurrentUser();
 * const subscription = await SubscriptionQueries.getAccountSubscription(accountUuid);
 * ```
 */

// Legacy queries (deprecated - use Account/User/Subscription queries instead)
export { CompanyQueries } from './companies';
export { ProfileQueries } from './profiles';
export { MembershipQueries } from './company_members';

// B2B Schema queries (recommended)
export { AccountQueries } from './accounts';
export { UserQueries } from './users';
export { SubscriptionQueries } from './subscriptions';

// Export types
export type { TrialStatus } from './subscriptions';
