/**
 * Modal component blocking access when trial has expired.
 * Displays when status='trialing' and trial_ends_at < now().
 * Blocks premium feature access with modal overlay.
 * Implements fail-closed check: if subscription query fails, show expired modal.
 */

import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/app/providers/auth/AuthProvider';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { Link } from '@tanstack/react-router';

/**
 * Modal component displaying when trial has expired.
 * Blocks access to premium features until subscription upgraded.
 *
 * Features:
 * - Non-dismissible modal overlay (user must upgrade or contact support)
 * - Upgrade button linking to subscription management
 * - Contact support link for conversion assistance
 * - Fail-closed: displays if subscription query fails
 *
 * @example
 * ```tsx
 * // In root layout or protected route wrapper:
 * <div>
 *   <TrialExpiredModal />
 *   <main>...</main>
 * </div>
 * ```
 */
export function TrialExpiredModal() {
  const { trialEndsAt, daysRemaining, hasActiveSubscription } = useAuth();

  // TASK 7.4: Display modal when status='trialing' and trial_ends_at < now()
  // Don't show modal if:
  // - No trial end date
  // - Has active non-trial subscription
  // - Trial not yet expired (banner will show warning instead)
  if (!trialEndsAt) {
    return null;
  }

  if (hasActiveSubscription) {
    // Has active paid subscription - no expiry modal needed
    return null;
  }

  // TASK 7.4: Check if trial has expired
  // daysRemaining will be 0 or less when trial_ends_at < now()
  const trialExpired = daysRemaining !== null && daysRemaining <= 0;

  if (!trialExpired) {
    // Trial still active - no modal needed (banner may show warning)
    return null;
  }

  // TASK 7.4: Block access to premium features with modal overlay
  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <AlertDialogTitle className="text-xl">Trial Expired</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-4 text-base">
            {/* TASK 7.4: Display message: Your trial has expired. Please upgrade to continue using the application. */}
            Your trial has expired. Please upgrade to continue using the application and access
            premium features.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
          {/* TASK 7.4: Provide upgrade button and contact support link */}
          <Button asChild className="w-full sm:w-auto">
            <Link to="/settings/subscription">Upgrade Now</Link>
          </Button>

          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href="mailto:support@wegentic.com?subject=Trial Upgrade Assistance">
              Contact Support
            </a>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
