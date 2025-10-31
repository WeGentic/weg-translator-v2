/**
 * End-to-End Registration Flow Tests
 *
 * This test suite validates the complete registration flow including:
 * - User sign-up with Supabase Auth
 * - Email verification process
 * - Company creation via Edge Function
 * - Company membership creation with role='owner'
 * - Profile auto-creation via database trigger
 * - Post-registration orphan detection
 *
 * NOTE: These tests require a running Supabase instance with the complete schema
 * (companies, profiles, company_members tables with triggers and RLS policies).
 * Tests are marked as integration tests and should be run against a test database.
 *
 * @module registration.test
 * @group e2e
 * @requires supabase-test-instance
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { supabase } from "@/core/config/supabaseClient";
import { checkIfOrphaned } from "@/modules/auth/utils/orphanDetection";
import type { NormalizedRegistrationPayload } from "@/modules/auth/hooks/controllers/useRegistrationSubmission";

// Test configuration
const TEST_TIMEOUT_MS = 30_000; // 30 seconds for E2E tests

// Test data generator
function generateTestRegistrationPayload(suffix: string): NormalizedRegistrationPayload {
  const timestamp = Date.now();
  const email = `test-${timestamp}-${suffix}@example.com`;

  return {
    admin: {
      email,
      password: "SecureTestPassword123!",
    },
    company: {
      name: `Test Company ${timestamp} ${suffix}`,
      email,
      phone: "+1234567890",
      taxId: `US${timestamp}${suffix}`,
      taxCountryCode: "US",
      address: {
        freeform: "123 Test Street, Test City, TS 12345, USA",
        line1: "123 Test Street",
        line2: null,
        city: "Test City",
        state: "TS",
        postalCode: "12345",
        countryCode: "US",
      },
    },
  };
}

// Cleanup helper
async function cleanupTestUser(userId: string): Promise<void> {
  try {
    // Delete user cascades to profiles and memberships
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.warn("Failed to cleanup test user:", userId, error);
    }
  } catch (error) {
    console.warn("Exception during test user cleanup:", error);
  }
}

describe("Registration Flow E2E", () => {
  describe("Complete Registration Flow", () => {
    it(
      "should complete full registration with company and membership",
      async () => {
        const payload = generateTestRegistrationPayload("complete");
        let userId: string | undefined;

        try {
          // Step 1: Sign up with Supabase Auth
          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: payload.admin.email,
            password: payload.admin.password,
            options: {
              data: {
                company_name: payload.company.name,
                company_phone: payload.company.phone,
                tax_id: payload.company.taxId,
              },
            },
          });

          expect(signupError).toBeNull();
          expect(signupData.user).toBeDefined();
          expect(signupData.user?.email).toBe(payload.admin.email);

          userId = signupData.user!.id;

          // Step 2: Verify profile auto-created by trigger
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          // Profile should be auto-created even if metadata is missing
          expect(profileError).toBeNull();
          expect(profile).toBeDefined();
          expect(profile?.id).toBe(userId);

          // Step 3: Simulate email verification (test helper required)
          // In production, user clicks link in email
          // In test, we need to manually verify or use test helper
          // NOTE: This requires Supabase service role access
          const { error: verifyError } = await supabase.auth.admin.updateUserById(userId, {
            email_confirmed_at: new Date().toISOString(),
          });

          expect(verifyError).toBeNull();

          // Step 4: Sign in to get auth token
          const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
            email: payload.admin.email,
            password: payload.admin.password,
          });

          expect(signinError).toBeNull();
          expect(signinData.user).toBeDefined();
          expect(signinData.user?.email_confirmed_at).not.toBeNull();

          // Step 5: Create company via Edge Function
          const { data: companyData, error: edgeFunctionError } = await supabase.functions.invoke(
            "register-organization",
            {
              body: {
                attemptId: crypto.randomUUID(),
                company: payload.company,
              },
            }
          );

          expect(edgeFunctionError).toBeNull();
          expect(companyData.data).toBeDefined();
          expect(companyData.data.companyId).toBeDefined();
          expect(companyData.data.adminUuid).toBe(userId);
          expect(companyData.data.membershipId).toBeDefined();

          const companyId = companyData.data.companyId;
          const membershipId = companyData.data.membershipId;

          // Step 6: Verify company created in database
          const { data: company, error: companyError } = await supabase
            .from("companies")
            .select("*")
            .eq("id", companyId)
            .maybeSingle();

          expect(companyError).toBeNull();
          expect(company).toBeDefined();
          expect(company?.name).toBe(payload.company.name);
          expect(company?.email).toBe(payload.company.email);
          expect(company?.tax_id).toBe(payload.company.taxId);

          // Step 7: Verify membership created with role='owner'
          const { data: membership, error: membershipError } = await supabase
            .from("company_members")
            .select("*")
            .eq("id", membershipId)
            .maybeSingle();

          expect(membershipError).toBeNull();
          expect(membership).toBeDefined();
          expect(membership?.company_id).toBe(companyId);
          expect(membership?.user_id).toBe(userId);
          expect(membership?.role).toBe("owner");
          expect(membership?.invited_by).toBeNull(); // Self-registration

          // Step 8: Verify orphan detection confirms user not orphaned
          const orphanCheck = await checkIfOrphaned(userId);

          expect(orphanCheck.isOrphaned).toBe(false);
          expect(orphanCheck.classification).toBeNull();
          expect(orphanCheck.metrics.attemptCount).toBeLessThanOrEqual(3);
          expect(orphanCheck.metrics.totalDurationMs).toBeLessThan(2000);
        } finally {
          // Cleanup
          if (userId) {
            await cleanupTestUser(userId);
          }
        }
      },
      { timeout: TEST_TIMEOUT_MS }
    );
  });

  describe("Registration Failure Scenarios", () => {
    it(
      "should reject registration with duplicate VAT ID",
      async () => {
        const payload = generateTestRegistrationPayload("duplicate-vat");
        let userId1: string | undefined;
        let userId2: string | undefined;

        try {
          // Create first user with specific VAT ID
          const { data: signup1 } = await supabase.auth.signUp({
            email: payload.admin.email,
            password: payload.admin.password,
          });
          userId1 = signup1.user?.id;

          // Verify email
          if (userId1) {
            await supabase.auth.admin.updateUserById(userId1, {
              email_confirmed_at: new Date().toISOString(),
            });

            // Sign in
            await supabase.auth.signInWithPassword({
              email: payload.admin.email,
              password: payload.admin.password,
            });

            // Create first company
            const { error: firstCompanyError } = await supabase.functions.invoke(
              "register-organization",
              {
                body: {
                  attemptId: crypto.randomUUID(),
                  company: payload.company,
                },
              }
            );

            expect(firstCompanyError).toBeNull();
          }

          // Create second user with SAME VAT ID
          const payload2 = generateTestRegistrationPayload("duplicate-vat-2");
          payload2.company.taxId = payload.company.taxId; // Duplicate VAT ID

          const { data: signup2 } = await supabase.auth.signUp({
            email: payload2.admin.email,
            password: payload2.admin.password,
          });
          userId2 = signup2.user?.id;

          // Verify email
          if (userId2) {
            await supabase.auth.admin.updateUserById(userId2, {
              email_confirmed_at: new Date().toISOString(),
            });

            // Sign in
            await supabase.auth.signOut();
            await supabase.auth.signInWithPassword({
              email: payload2.admin.email,
              password: payload2.admin.password,
            });

            // Attempt to create second company (should fail)
            const { data: secondCompanyData } = await supabase.functions.invoke(
              "register-organization",
              {
                body: {
                  attemptId: crypto.randomUUID(),
                  company: payload2.company,
                },
              }
            );

            // Should return error for duplicate VAT ID
            expect(secondCompanyData.error).toBeDefined();
            expect(secondCompanyData.error?.code).toBe("conflict");
            expect(secondCompanyData.error?.message).toContain("already exists");
          }
        } finally {
          // Cleanup
          if (userId1) await cleanupTestUser(userId1);
          if (userId2) await cleanupTestUser(userId2);
        }
      },
      { timeout: TEST_TIMEOUT_MS }
    );

    it(
      "should reject registration with invalid email format",
      async () => {
        const invalidPayload: NormalizedRegistrationPayload = {
          admin: {
            email: "invalid-email",
            password: "SecurePassword123!",
          },
          company: {
            name: "Test Company",
            email: "invalid-email",
            phone: "+1234567890",
            taxId: "US123456789",
            address: {
              freeform: "123 Test St",
            },
          },
        };

        // Sign up should fail with invalid email
        const { error: signupError } = await supabase.auth.signUp({
          email: invalidPayload.admin.email,
          password: invalidPayload.admin.password,
        });

        expect(signupError).toBeDefined();
      },
      { timeout: TEST_TIMEOUT_MS }
    );

    it(
      "should rollback company if membership creation fails",
      async () => {
        // This test requires database manipulation to force membership failure
        // NOTE: Implementation requires direct database access or mock
        // Structure provided for reference

        const payload = generateTestRegistrationPayload("rollback-test");
        let userId: string | undefined;

        try {
          // Sign up and verify
          const { data: signupData } = await supabase.auth.signUp({
            email: payload.admin.email,
            password: payload.admin.password,
          });
          userId = signupData.user?.id;

          if (userId) {
            await supabase.auth.admin.updateUserById(userId, {
              email_confirmed_at: new Date().toISOString(),
            });

            // TODO: Force membership creation to fail via database constraint
            // This requires service role access to manipulate constraints

            // Attempt registration - should rollback company creation
            const { data: companyData } = await supabase.functions.invoke("register-organization", {
              body: {
                attemptId: crypto.randomUUID(),
                company: payload.company,
              },
            });

            // Verify error returned
            expect(companyData.error).toBeDefined();

            // Verify no company created
            if (companyData.data?.companyId) {
              const { data: company } = await supabase
                .from("companies")
                .select("id")
                .eq("id", companyData.data.companyId)
                .maybeSingle();

              expect(company).toBeNull(); // Should be rolled back
            }
          }
        } finally {
          if (userId) await cleanupTestUser(userId);
        }
      },
      { timeout: TEST_TIMEOUT_MS, skip: true } // Skip until database manipulation available
    );
  });

  describe("State Machine Transitions", () => {
    it(
      "should transition through all phases correctly",
      async () => {
        // This test validates the registration state machine in useRegistrationSubmission
        // Requires frontend component testing or integration with React Testing Library
        // Structure provided for reference

        // Expected phases: idle → signingUp → awaitingVerification → verifying → persisting → succeeded
        // OR: idle → signingUp → awaitingVerification → verifying → persisting → failed

        // NOTE: Full implementation requires React component testing setup
      },
      { skip: true } // Skip until React Testing Library setup available
    );

    it(
      "should handle manual verification check button",
      async () => {
        // Test manual verification check during awaitingVerification phase
        // Requires frontend component testing

        // NOTE: Full implementation requires React component testing setup
      },
      { skip: true } // Skip until React Testing Library setup available
    );

    it(
      "should handle polling timeout gracefully",
      async () => {
        // Test verification polling behavior with exponential backoff
        // Requires mocking setTimeout or using fake timers

        // NOTE: Full implementation requires frontend component testing setup
      },
      { skip: true } // Skip until React Testing Library setup available
    );
  });
});
