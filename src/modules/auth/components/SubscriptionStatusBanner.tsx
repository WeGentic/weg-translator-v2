/**
 * Warning banner displayed when trial expires within 3 days.
 * Shows days remaining and prompts user to upgrade.
 * Uses ShadCN Alert component for consistent UI.
 */

import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/app/providers/auth/AuthProvider';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Link } from '@tanstack/react-router';

/**
 * Banner component displaying trial expiry warnings.
 * Only renders when:
 * - User has account with subscription status
 * - Trial expires within 3 days
 * - Trial has not expired yet
 *
 * @example
 * ```tsx
 * // In root layout or app shell:
 * <div>
 *   <SubscriptionStatusBanner />
 *   <main>...</main>
 * </div>
 * ```
 */
export function SubscriptionStatusBanner() {
  const { trialEndsAt, daysRemaining, hasActiveSubscription } = useAuth();

  // TASK 7.3: Calculate days remaining and check if within 3 days
  // Don't show banner if:
  // - No trial end date
  // - Already has active (non-trial) subscription
  // - Trial already expired (will show modal instead)
  // - More than 3 days remaining
  if (!trialEndsAt) {
    return null;
  }

  if (hasActiveSubscription && daysRemaining === null) {
    // Has active paid subscription - no trial warning needed
    return null;
  }

  if (daysRemaining === null || daysRemaining < 0) {
    // Trial expired - modal will handle this
    return null;
  }

  if (daysRemaining > 3) {
    // More than 3 days remaining - no warning yet
    return null;
  }

  // TASK 7.3: Display warning message with days remaining
  const message =
    daysRemaining === 0
      ? 'Your trial expires today. Upgrade now to continue accessing premium features.'
      : daysRemaining === 1
        ? 'Your trial expires in 1 day. Upgrade now to continue accessing premium features.'
        : `Your trial expires in ${daysRemaining} days. Upgrade now to continue accessing premium features.`;

  return (
    <Alert variant="default" className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertTitle className="text-yellow-900 dark:text-yellow-100">Trial Expiring Soon</AlertTitle>
      <AlertDescription className="text-yellow-800 dark:text-yellow-200">
        <div className="flex items-center justify-between gap-4">
          <span>{message}</span>
          {/* TASK 7.3: Include Upgrade button linking to subscription management page */}
          <Button asChild variant="default" size="sm">
            <Link to="/settings/subscription">Upgrade</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
