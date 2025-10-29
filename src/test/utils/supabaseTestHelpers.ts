/**
 * Supabase Test Helpers for E2E and Integration Tests
 *
 * Provides utility functions for creating test users, orphaned accounts,
 * and cleaning up test data. These helpers enable isolated, repeatable
 * testing of authentication and registration flows.
 *
 * @module test/utils/supabaseTestHelpers
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Test Supabase client with service role privileges
 * WARNING: Only use in test environment, never in production
 */
let testClient: SupabaseClient | null = null;

export function createTestSupabaseClient(): SupabaseClient {
  if (testClient) return testClient;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase test configuration. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  testClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return testClient;
}

/**
 * Options for creating orphaned user
 */
export interface CreateOrphanedUserOptions {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** Whether email should be verified (Case 1.1: false, Case 1.2: true) */
  emailVerified: boolean;
  /** Additional user metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from creating orphaned user
 */
export interface OrphanedUserResult {
  /** User ID in auth.users */
  userId: string;
  /** User object */
  user: User;
  /** Session access token (if email verified) */
  accessToken?: string;
}

/**
 * Create an orphaned user for testing
 *
 * Creates a user in auth.users but intentionally does NOT create
 * corresponding records in companies or company_admins tables,
 * resulting in an orphaned state.
 *
 * @param options - Configuration for orphaned user
 * @returns User ID and user object
 *
 * @example
 * // Create Case 1.1: unverified email + orphaned
 * const { userId } = await createOrphanedUser({
 *   email: 'test@example.com',
 *   password: 'Test123!',
 *   emailVerified: false,
 * });
 *
 * @example
 * // Create Case 1.2: verified email + orphaned
 * const { userId } = await createOrphanedUser({
 *   email: 'test@example.com',
 *   password: 'Test123!',
 *   emailVerified: true,
 * });
 */
export async function createOrphanedUser(options: CreateOrphanedUserOptions): Promise<OrphanedUserResult> {
  const client = createTestSupabaseClient();

  // Step 1: Create user via admin API
  const { data: userData, error: createError } = await client.auth.admin.createUser({
    email: options.email,
    password: options.password,
    email_confirm: options.emailVerified, // Auto-confirm if verified=true
    user_metadata: options.metadata || {},
  });

  if (createError || !userData.user) {
    throw new Error(`Failed to create test user: ${createError?.message || 'Unknown error'}`);
  }

  const user = userData.user;

  // Step 2: If email verified, get session token for testing
  let accessToken: string | undefined;
  if (options.emailVerified) {
    const { data: sessionData, error: sessionError } = await client.auth.signInWithPassword({
      email: options.email,
      password: options.password,
    });

    if (sessionError) {
      console.warn('Failed to create session for verified user:', sessionError.message);
    } else {
      accessToken = sessionData.session?.access_token;
    }

    // Sign out to clean up session
    await client.auth.signOut();
  }

  // Step 3: Verify user is orphaned (no company data)
  const { data: companies } = await client.from('companies').select('id').eq('owner_admin_uuid', user.id).limit(1);

  const { data: admins } = await client.from('company_admins').select('admin_uuid').eq('admin_uuid', user.id).limit(1);

  if (companies && companies.length > 0) {
    throw new Error('User is not orphaned - has company data');
  }

  if (admins && admins.length > 0) {
    throw new Error('User is not orphaned - has admin data');
  }

  console.log(`✓ Created orphaned user: ${options.email} (verified: ${options.emailVerified})`);

  return {
    userId: user.id,
    user,
    accessToken,
  };
}

/**
 * Clean up test user and all related data
 *
 * Removes user from auth.users and any orphaned records in
 * companies, company_admins, verification_codes, rate_limits, etc.
 *
 * @param email - User's email address
 * @param userId - Optional user ID (will lookup if not provided)
 *
 * @example
 * await cleanupTestUser('test@example.com', userId);
 */
export async function cleanupTestUser(email: string, userId?: string): Promise<void> {
  const client = createTestSupabaseClient();

  try {
    // Step 1: Find user if userId not provided
    let userIdToDelete = userId;

    if (!userIdToDelete) {
      const { data: users } = await client.auth.admin.listUsers();
      const user = users?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        console.warn(`No user found with email ${email}, skipping cleanup`);
        return;
      }

      userIdToDelete = user.id;
    }

    // Step 2: Delete from companies (if exists)
    await client.from('companies').delete().eq('owner_admin_uuid', userIdToDelete);

    // Step 3: Delete from company_admins (if exists)
    await client.from('company_admins').delete().eq('admin_uuid', userIdToDelete);

    // Step 4: Delete verification codes
    const emailHash = await hashEmail(email);
    await client.from('verification_codes').delete().eq('email_hash', emailHash);

    // Step 5: Delete rate limit entries
    await client.from('rate_limits').delete().like('key', `%${emailHash}%`);

    // Step 6: Delete user from auth.users
    const { error: deleteError } = await client.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      console.warn(`Failed to delete user ${email}:`, deleteError.message);
    } else {
      console.log(`✓ Cleaned up test user: ${email}`);
    }
  } catch (error) {
    console.error(`Error cleaning up test user ${email}:`, error);
    throw error;
  }
}

/**
 * Hash email address for database lookups
 * Uses SHA-256 matching edge function implementation
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify test user's email directly (bypass email verification link)
 *
 * @param userId - User ID to verify
 */
export async function verifyTestUserEmail(userId: string): Promise<void> {
  const client = createTestSupabaseClient();

  const { error } = await client.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to verify test user email: ${error.message}`);
  }

  console.log(`✓ Verified email for user: ${userId}`);
}

/**
 * Create test company and admin entry for user
 *
 * Converts orphaned user into complete user with company data
 *
 * @param userId - User ID
 * @param companyName - Company name
 */
export async function createTestCompanyForUser(userId: string, companyName: string): Promise<string> {
  const client = createTestSupabaseClient();

  // Create company
  const { data: company, error: companyError } = await client
    .from('companies')
    .insert({
      name: companyName,
      owner_admin_uuid: userId,
      // Add other required fields based on your schema
    })
    .select()
    .single();

  if (companyError || !company) {
    throw new Error(`Failed to create test company: ${companyError?.message || 'Unknown error'}`);
  }

  // Create admin entry
  const { error: adminError } = await client.from('company_admins').insert({
    company_id: company.id,
    admin_uuid: userId,
    // Add other required fields based on your schema
  });

  if (adminError) {
    // Rollback: delete company
    await client.from('companies').delete().eq('id', company.id);
    throw new Error(`Failed to create admin entry: ${adminError.message}`);
  }

  console.log(`✓ Created company "${companyName}" for user: ${userId}`);

  return company.id;
}

/**
 * Check if user is orphaned
 *
 * @param userId - User ID to check
 * @returns True if orphaned (no company data), false otherwise
 */
export async function isUserOrphaned(userId: string): Promise<boolean> {
  const client = createTestSupabaseClient();

  const { data: companies } = await client.from('companies').select('id').eq('owner_admin_uuid', userId).limit(1);

  const { data: admins } = await client.from('company_admins').select('admin_uuid').eq('admin_uuid', userId).limit(1);

  const hasCompanyData = Boolean(companies && companies.length > 0);
  const hasAdminData = Boolean(admins && admins.length > 0);

  return !hasCompanyData && !hasAdminData;
}

/**
 * Wait for condition with timeout
 *
 * @param condition - Async function that returns true when condition met
 * @param options - Timeout and poll interval options
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, timeoutMessage = 'Condition not met within timeout' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}

/**
 * Mock email verification code retrieval (TEST MODE)
 *
 * In test mode, retrieves plaintext verification code from database
 * WARNING: This requires TEST_MODE environment variable to be set
 *
 * @param email - User's email address
 * @returns Verification code (8-char alphanumeric)
 */
export async function getTestVerificationCode(email: string): Promise<string> {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('getTestVerificationCode can only be used in test mode');
  }

  const client = createTestSupabaseClient();
  const emailHash = await hashEmail(email);

  // Query verification_codes table
  const { data, error } = await client
    .from('verification_codes')
    .select('id, created_at')
    .eq('email_hash', emailHash)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`No verification code found for ${email}: ${error?.message || 'Not found'}`);
  }

  // TODO: Implement test mode where plaintext codes are accessible
  // For now, return a mock code
  // In production implementation, edge function should support TEST_MODE
  // which returns plaintext code instead of sending email

  return 'TEST-CODE'; // Placeholder
}
