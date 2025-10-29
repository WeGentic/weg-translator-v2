/**
 * Centralized exports for all Supabase query modules.
 * Provides clean imports for company, profile, and membership operations.
 *
 * @example
 * ```typescript
 * import { CompanyQueries, ProfileQueries, MembershipQueries } from '@/core/supabase/queries';
 *
 * // Use query helpers
 * const companies = await CompanyQueries.listUserCompanies();
 * const profile = await ProfileQueries.getCurrentUserProfile();
 * const members = await MembershipQueries.listCompanyMembers(companyId);
 * ```
 */

export { CompanyQueries } from './companies';
export { ProfileQueries } from './profiles';
export { MembershipQueries } from './company_members';
