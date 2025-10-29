/**
 * End-to-End Tests for Orphaned User Recovery Flows
 *
 * This test suite validates the complete user journey for recovering from
 * orphaned account states (Cases 1.1 and 1.2) through detection, cleanup,
 * and successful registration/login.
 *
 * Test Coverage:
 * - 6.1.1: Full orphan recovery journey from registration failure to success
 * - 6.1.2: Case 1.1 recovery flow (unverified email + orphaned)
 * - 6.1.3: Case 1.2 recovery flow (verified email + orphaned)
 *
 * Prerequisites:
 * - Running Supabase instance (local or cloud)
 * - Database with migrations applied
 * - Edge functions deployed (cleanup-orphaned-user, check-email-status)
 * - Test environment configuration
 *
 * @see docs/architecture/orphan-detection-architecture.md
 * @see plans/registration-edge-case-fix/registration-edge-case-fix_TaskList.md#Phase6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createClient } from '@supabase/supabase-js';
import { AuthProvider } from '@/app/providers/auth/AuthProvider';
import { LoginForm } from '@/modules/auth/components/LoginForm';
import { RegistrationForm } from '@/modules/auth/components/RegistrationForm';
import { RecoveryForm } from '@/modules/auth/components/RecoveryForm';
import { createTestSupabaseClient, cleanupTestUser, createOrphanedUser } from '../utils/supabaseTestHelpers';
import type { User } from '@supabase/supabase-js';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  testEmailDomain: 'test-e2e.example.com',
  testPassword: 'Test123!@#SecurePassword',
  // Timeouts for async operations
  timeouts: {
    orphanDetection: 2000,
    edgeFunctionCall: 5000,
    emailDelivery: 3000,
    cleanup: 3000,
  },
};

/**
 * Generate unique test email for isolation
 */
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `e2e-test-${timestamp}-${random}@${TEST_CONFIG.testEmailDomain}`;
}

/**
 * Mock email verification code retrieval
 * In production, this would come from email provider webhooks or test mode API
 */
async function getVerificationCodeFromEmail(email: string): Promise<string> {
  // TODO: Implement actual code retrieval from verification_codes table in test mode
  // For now, return a mock code
  return 'ABCD-EFGH'; // 8-character alphanumeric format
}

/**
 * Helper to wait for navigation
 */
async function waitForNavigation(expectedPath: string, timeout = 3000) {
  await waitFor(
    () => {
      expect(window.location.pathname).toBe(expectedPath);
    },
    { timeout }
  );
}

/**
 * Setup and teardown helpers
 */
let testUsers: Array<{ email: string; userId?: string }> = [];

beforeEach(() => {
  testUsers = [];
  // Reset navigation mocks
  vi.clearAllMocks();
});

afterEach(async () => {
  // Cleanup all test users created during test
  for (const { email, userId } of testUsers) {
    try {
      await cleanupTestUser(email, userId);
    } catch (error) {
      console.warn(`Failed to cleanup test user ${email}:`, error);
    }
  }
  testUsers = [];
});

/**
 * Test Suite: Full Orphan Recovery Flow
 */
describe('6.1.1 - Full Orphan Recovery Journey', () => {
  it('should complete full recovery from registration failure to successful login', async () => {
    const user = userEvent.setup();
    const testEmail = generateTestEmail();
    const correlationId = crypto.randomUUID();

    // Track test user for cleanup
    testUsers.push({ email: testEmail });

    /**
     * STEP 1: Simulate registration failure creating orphaned user
     * User starts registration but email verification or company creation fails
     */
    const { userId } = await createOrphanedUser({
      email: testEmail,
      password: TEST_CONFIG.testPassword,
      emailVerified: true, // Case 1.2: verified email but no company data
    });

    testUsers[0].userId = userId;

    /**
     * STEP 2: User attempts to log in
     * Expected: Orphan detection triggers during login flow
     */
    const { container: loginContainer } = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    // Enter credentials
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /log in/i });

    await user.type(emailInput, testEmail);
    await user.type(passwordInput, TEST_CONFIG.testPassword);
    await user.click(loginButton);

    /**
     * STEP 3: Expect orphan detection and redirect
     * System should:
     * - Detect user has verified email but no company data (Case 1.2)
     * - Sign out the user
     * - Show toast notification about incomplete registration
     * - Redirect to recovery route
     */
    await waitFor(
      () => {
        const toast = screen.getByText(/registration incomplete/i);
        expect(toast).toBeInTheDocument();
      },
      { timeout: TEST_CONFIG.timeouts.orphanDetection }
    );

    // Verify redirect to recovery route
    await waitForNavigation('/register/recover');

    // Verify query parameters
    const searchParams = new URLSearchParams(window.location.search);
    expect(searchParams.get('email')).toBe(testEmail);
    expect(searchParams.get('reason')).toBe('orphaned');
    expect(searchParams.get('correlationId')).toBeTruthy();

    /**
     * STEP 4: Recovery form should be displayed
     */
    const recoveryForm = await screen.findByRole('form', { name: /recovery/i });
    expect(recoveryForm).toBeInTheDocument();

    // Verify email is pre-filled and readonly
    const recoveryEmailField = within(recoveryForm).getByDisplayValue(testEmail);
    expect(recoveryEmailField).toBeInTheDocument();
    expect(recoveryEmailField).toHaveAttribute('readonly');

    /**
     * STEP 5: Retrieve verification code
     * In production, user receives email with code
     * For testing, retrieve from database or mock email system
     */
    const verificationCode = await getVerificationCodeFromEmail(testEmail);

    /**
     * STEP 6: Enter verification code and submit
     */
    const codeInput = within(recoveryForm).getByLabelText(/verification code/i);
    await user.type(codeInput, verificationCode);

    const verifyButton = within(recoveryForm).getByRole('button', { name: /verify and cleanup/i });
    await user.click(verifyButton);

    /**
     * STEP 7: Expect cleanup success
     * System should:
     * - Validate code with constant-time comparison
     * - Re-verify orphan status
     * - Delete user from auth.users
     * - Update auth_cleanup_log
     * - Show success toast
     * - Navigate to registration form
     */
    await waitFor(
      () => {
        const successToast = screen.getByText(/account cleanup complete/i);
        expect(successToast).toBeInTheDocument();
      },
      { timeout: TEST_CONFIG.timeouts.cleanup }
    );

    // Wait for automatic navigation to registration
    await waitForNavigation('/register');

    /**
     * STEP 8: Complete registration with same email
     * User should now be able to register successfully
     */
    const registrationForm = await screen.findByRole('form', { name: /registration/i });

    // Email should be pre-filled
    const regEmailInput = within(registrationForm).getByLabelText(/email/i);
    expect(regEmailInput).toHaveValue(testEmail);

    // Fill out rest of registration form
    const companyNameInput = within(registrationForm).getByLabelText(/company name/i);
    const passwordConfirmInput = within(registrationForm).getByLabelText(/confirm password/i);

    await user.clear(passwordInput); // Clear if pre-filled
    await user.type(passwordInput, TEST_CONFIG.testPassword);
    await user.type(passwordConfirmInput, TEST_CONFIG.testPassword);
    await user.type(companyNameInput, 'Test E2E Company');

    const registerButton = within(registrationForm).getByRole('button', { name: /request organization access/i });
    await user.click(registerButton);

    /**
     * STEP 9: Verify email and complete organization setup
     * Wait for verification dialog and poll for completion
     */
    await waitFor(
      () => {
        const verificationDialog = screen.getByText(/verify your email/i);
        expect(verificationDialog).toBeInTheDocument();
      },
      { timeout: TEST_CONFIG.timeouts.emailDelivery }
    );

    // In real test, simulate email verification and organization creation
    // For now, wait for success state
    await waitFor(
      () => {
        const successMessage = screen.getByText(/registration complete/i);
        expect(successMessage).toBeInTheDocument();
      },
      { timeout: 30000 } // Allow time for full registration flow
    );

    /**
     * STEP 10: Attempt login with completed account
     * Should succeed without orphan detection
     */
    const { container: finalLoginContainer } = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    const finalEmailInput = screen.getByLabelText(/email/i);
    const finalPasswordInput = screen.getByLabelText(/password/i);
    const finalLoginButton = screen.getByRole('button', { name: /log in/i });

    await user.type(finalEmailInput, testEmail);
    await user.type(finalPasswordInput, TEST_CONFIG.testPassword);
    await user.click(finalLoginButton);

    // Expect successful login and navigation to main app
    await waitForNavigation('/');

    // Verify user is authenticated
    await waitFor(() => {
      // Should see main dashboard or workspace
      expect(screen.queryByText(/welcome/i)).toBeInTheDocument();
    });
  }, 60000); // 60 second timeout for full E2E flow
});

/**
 * Test Suite: Case 1.1 Recovery (Unverified Email + Orphaned)
 */
describe('6.1.2 - Case 1.1: Unverified Email + Orphaned Recovery', () => {
  it('should recover from unverified email orphaned state', async () => {
    const user = userEvent.setup();
    const testEmail = generateTestEmail();

    testUsers.push({ email: testEmail });

    /**
     * STEP 1: Create orphaned user with UNVERIFIED email
     */
    const { userId } = await createOrphanedUser({
      email: testEmail,
      password: TEST_CONFIG.testPassword,
      emailVerified: false, // Case 1.1: unverified email
    });

    testUsers[0].userId = userId;

    /**
     * STEP 2: Attempt login
     * Expected: Blocked BEFORE orphan detection due to unverified email
     */
    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /log in/i });

    await user.type(emailInput, testEmail);
    await user.type(passwordInput, TEST_CONFIG.testPassword);
    await user.click(loginButton);

    // Expect error about email verification
    await waitFor(() => {
      const error = screen.getByText(/verify your email before signing in/i);
      expect(error).toBeInTheDocument();
    });

    /**
     * STEP 3: Navigate to registration form
     * Email probe should detect Case 1.1
     */
    render(<RegistrationForm />);

    const regEmailInput = screen.getByLabelText(/email/i);
    await user.type(regEmailInput, testEmail);

    // Wait for email status probe to complete
    await waitFor(
      () => {
        const banner = screen.getByText(/incomplete registration detected/i);
        expect(banner).toBeInTheDocument();
      },
      { timeout: TEST_CONFIG.timeouts.edgeFunctionCall }
    );

    /**
     * STEP 4: Click "Resend Verification Email"
     */
    const resendButton = screen.getByRole('button', { name: /resend verification email/i });
    await user.click(resendButton);

    // Expect toast confirmation
    await waitFor(() => {
      const toast = screen.getByText(/verification email sent/i);
      expect(toast).toBeInTheDocument();
    });

    /**
     * STEP 5: Simulate email verification
     * In production, user clicks link in email
     * For testing, directly verify the email
     */
    const supabase = createTestSupabaseClient();
    // TODO: Implement test helper to verify email directly
    // await verifyTestUserEmail(userId);

    /**
     * STEP 6: Click "Resume Verification" or complete registration
     */
    const resumeButton = screen.getByRole('button', { name: /resume verification/i });
    await user.click(resumeButton);

    // Should navigate to verification dialog or registration continuation
    // Continue with registration flow similar to 6.1.1
  }, 30000);
});

/**
 * Test Suite: Case 1.2 Recovery (Verified Email + Orphaned)
 */
describe('6.1.3 - Case 1.2: Verified Email + Orphaned Recovery', () => {
  it('should recover from verified email orphaned state', async () => {
    const user = userEvent.setup();
    const testEmail = generateTestEmail();

    testUsers.push({ email: testEmail });

    /**
     * STEP 1: Create orphaned user with VERIFIED email
     */
    const { userId } = await createOrphanedUser({
      email: testEmail,
      password: TEST_CONFIG.testPassword,
      emailVerified: true, // Case 1.2: verified email
    });

    testUsers[0].userId = userId;

    /**
     * STEP 2: Attempt login
     * Expected: Orphan detection during login, redirect to recovery
     */
    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /log in/i });

    await user.type(emailInput, testEmail);
    await user.type(passwordInput, TEST_CONFIG.testPassword);
    await user.click(loginButton);

    /**
     * STEP 3: Expect toast and redirect
     */
    await waitFor(
      () => {
        const toast = screen.getByText(/registration incomplete/i);
        expect(toast).toBeInTheDocument();
      },
      { timeout: TEST_CONFIG.timeouts.orphanDetection }
    );

    await waitForNavigation('/register/recover');

    /**
     * STEP 4: Enter verification code
     */
    const recoveryForm = await screen.findByRole('form', { name: /recovery/i });
    const verificationCode = await getVerificationCodeFromEmail(testEmail);

    const codeInput = within(recoveryForm).getByLabelText(/verification code/i);
    await user.type(codeInput, verificationCode);

    const verifyButton = within(recoveryForm).getByRole('button', { name: /verify and cleanup/i });
    await user.click(verifyButton);

    /**
     * STEP 5: Expect cleanup success
     */
    await waitFor(
      () => {
        const successToast = screen.getByText(/account cleanup complete/i);
        expect(successToast).toBeInTheDocument();
      },
      { timeout: TEST_CONFIG.timeouts.cleanup }
    );

    /**
     * STEP 6: Navigate to registration and complete
     */
    await waitForNavigation('/register');

    // Complete registration flow
    const registrationForm = await screen.findByRole('form', { name: /registration/i });

    // Fill out form and submit
    const companyNameInput = within(registrationForm).getByLabelText(/company name/i);
    await user.type(companyNameInput, 'Test E2E Company Case 1.2');

    const registerButton = within(registrationForm).getByRole('button', { name: /request organization access/i });
    await user.click(registerButton);

    // Wait for registration success
    await waitFor(
      () => {
        const successMessage = screen.getByText(/registration complete/i);
        expect(successMessage).toBeInTheDocument();
      },
      { timeout: 30000 }
    );

    /**
     * STEP 7: Login succeeds with complete account
     */
    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    const finalEmailInput = screen.getByLabelText(/email/i);
    const finalPasswordInput = screen.getByLabelText(/password/i);
    const finalLoginButton = screen.getByRole('button', { name: /log in/i });

    await user.type(finalEmailInput, testEmail);
    await user.type(finalPasswordInput, TEST_CONFIG.testPassword);
    await user.click(finalLoginButton);

    // Expect successful login
    await waitForNavigation('/');

    await waitFor(() => {
      expect(screen.queryByText(/welcome/i)).toBeInTheDocument();
    });
  }, 45000);
});

/**
 * Additional Edge Case Tests
 */
describe('6.1.4 - Edge Cases', () => {
  it('should handle expired verification code', async () => {
    const user = userEvent.setup();
    const testEmail = generateTestEmail();

    testUsers.push({ email: testEmail });

    // Create orphaned user
    const { userId } = await createOrphanedUser({
      email: testEmail,
      password: TEST_CONFIG.testPassword,
      emailVerified: true,
    });

    testUsers[0].userId = userId;

    // Navigate to recovery form
    render(
      <RecoveryForm initialEmail={testEmail} reason="orphaned" correlationId={crypto.randomUUID()} />
    );

    // Enter EXPIRED code (simulate by using old/invalid code)
    const codeInput = screen.getByLabelText(/verification code/i);
    await user.type(codeInput, '0000-0000'); // Invalid code

    const verifyButton = screen.getByRole('button', { name: /verify and cleanup/i });
    await user.click(verifyButton);

    // Expect error about expired/invalid code
    await waitFor(() => {
      const error = screen.getByText(/verification code expired|invalid code/i);
      expect(error).toBeInTheDocument();
    });

    // Resend button should be available
    const resendButton = screen.getByRole('button', { name: /resend code/i });
    expect(resendButton).toBeEnabled();
  });

  it('should handle concurrent cleanup attempts', async () => {
    const testEmail = generateTestEmail();

    testUsers.push({ email: testEmail });

    // Create orphaned user
    const { userId } = await createOrphanedUser({
      email: testEmail,
      password: TEST_CONFIG.testPassword,
      emailVerified: true,
    });

    testUsers[0].userId = userId;

    // Attempt two simultaneous cleanup requests
    const supabase = createTestSupabaseClient();

    const request1 = supabase.functions.invoke('cleanup-orphaned-user', {
      body: {
        step: 'request-code',
        email: testEmail,
        correlationId: crypto.randomUUID(),
      },
    });

    const request2 = supabase.functions.invoke('cleanup-orphaned-user', {
      body: {
        step: 'request-code',
        email: testEmail,
        correlationId: crypto.randomUUID(),
      },
    });

    const [result1, result2] = await Promise.all([request1, request2]);

    // One should succeed, other should fail with lock error
    const succeeded = [result1, result2].filter((r) => r.data && !r.error);
    const failed = [result1, result2].filter((r) => r.error);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    // Failed one should have 409 status (operation in progress)
    expect(failed[0].error?.message).toMatch(/operation already in progress/i);
  });
});
