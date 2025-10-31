/**
 * Tests for SubscriptionStatusBanner and TrialExpiredModal components.
 * TASK 7.6: Test banner and modal rendering based on subscription status.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubscriptionStatusBanner } from '../SubscriptionStatusBanner';
import { TrialExpiredModal } from '../TrialExpiredModal';
import type { ReactNode } from 'react';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/app/providers/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock TanStack Router Link component
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('SubscriptionStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TASK 7.6: Banner displays when trial < 3 days remaining', () => {
    it('shows banner when trial expires in 1 day', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 1,
        hasActiveSubscription: true,
      });

      render(<SubscriptionStatusBanner />);

      expect(
        screen.getByText(/Your trial expires in 1 day. Upgrade now to continue accessing premium features./)
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Upgrade/i })).toBeInTheDocument();
    });

    it('shows banner when trial expires in 2 days', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 2,
        hasActiveSubscription: true,
      });

      render(<SubscriptionStatusBanner />);

      expect(
        screen.getByText(/Your trial expires in 2 days. Upgrade now to continue accessing premium features./)
      ).toBeInTheDocument();
    });

    it('shows banner when trial expires today (0 days)', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now()).toISOString(),
        daysRemaining: 0,
        hasActiveSubscription: true,
      });

      render(<SubscriptionStatusBanner />);

      expect(
        screen.getByText(/Your trial expires today. Upgrade now to continue accessing premium features./)
      ).toBeInTheDocument();
    });
  });

  describe('TASK 7.6: Banner hides when > 3 days or active subscription', () => {
    it('hides banner when trial expires in 5 days (> 3 days)', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 5,
        hasActiveSubscription: true,
      });

      const { container } = render(<SubscriptionStatusBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('hides banner when user has active paid subscription', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: null,
        daysRemaining: null,
        hasActiveSubscription: true,
      });

      const { container } = render(<SubscriptionStatusBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('hides banner when trial has expired (modal will show instead)', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: -1,
        hasActiveSubscription: false,
      });

      const { container } = render(<SubscriptionStatusBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('hides banner when no trial end date', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: null,
        daysRemaining: null,
        hasActiveSubscription: false,
      });

      const { container } = render(<SubscriptionStatusBanner />);

      expect(container.firstChild).toBeNull();
    });
  });
});

describe('TrialExpiredModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TASK 7.6: Modal displays when trial expired', () => {
    it('shows modal when trial has expired (daysRemaining = 0 and no active subscription)', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 0,
        hasActiveSubscription: false,
      });

      render(<TrialExpiredModal />);

      expect(screen.getByText(/Trial Expired/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Your trial has expired. Please upgrade to continue using the application and access premium features./
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Upgrade Now/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Contact Support/i })).toBeInTheDocument();
    });

    it('shows modal when trial has expired (negative daysRemaining)', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: -3,
        hasActiveSubscription: false,
      });

      render(<TrialExpiredModal />);

      expect(screen.getByText(/Trial Expired/i)).toBeInTheDocument();
    });
  });

  describe('TASK 7.6: Modal provides upgrade path', () => {
    it('includes Upgrade Now button linking to subscription settings', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 0,
        hasActiveSubscription: false,
      });

      render(<TrialExpiredModal />);

      const upgradeButton = screen.getByRole('link', { name: /Upgrade Now/i });
      expect(upgradeButton).toBeInTheDocument();
      expect(upgradeButton).toHaveAttribute('href', '/settings/subscription');
    });

    it('includes Contact Support link with email', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 0,
        hasActiveSubscription: false,
      });

      render(<TrialExpiredModal />);

      const supportLink = screen.getByRole('link', { name: /Contact Support/i });
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', expect.stringContaining('mailto:support'));
    });
  });

  describe('TASK 7.6: Modal hides when trial active or subscription active', () => {
    it('hides modal when trial still active', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 2,
        hasActiveSubscription: true,
      });

      const { container } = render(<TrialExpiredModal />);

      expect(screen.queryByText(/Trial Expired/i)).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('hides modal when user has active paid subscription', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: null,
        daysRemaining: null,
        hasActiveSubscription: true,
      });

      const { container } = render(<TrialExpiredModal />);

      expect(screen.queryByText(/Trial Expired/i)).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('hides modal when no trial end date', () => {
      mockUseAuth.mockReturnValue({
        trialEndsAt: null,
        daysRemaining: null,
        hasActiveSubscription: false,
      });

      const { container } = render(<TrialExpiredModal />);

      expect(screen.queryByText(/Trial Expired/i)).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });
});
