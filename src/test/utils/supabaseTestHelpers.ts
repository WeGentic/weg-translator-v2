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

  // Step 3: Verify user is orphaned (no users table record or no account membership)
  const { data: userRecord } = await client
    .from('users')
    .select('user_uuid, account_uuid')
    .eq('user_uuid', user.id)
    .limit(1)
    .maybeSingle();

  if (userRecord && userRecord.account_uuid) {
    throw new Error('User is not orphaned - has valid account_uuid in users table');
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

    // Step 2: Delete from users table (if exists) - CASCADE will handle related records
    await client.from('users').delete().eq('user_uuid', userIdToDelete);

    // Step 3: Delete from accounts (if user was owner) - only if no other users
    // Note: RLS should prevent deletion if not permitted

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
 * Create test account and user entry
 *
 * Converts orphaned auth.users record into complete user with account membership
 * Uses create_account_with_admin() database function for atomic creation
 *
 * @param userId - Auth user ID
 * @param companyName - Company/account name
 * @param companyEmail - Company email (must be unique globally)
 */
export async function createTestAccountForUser(
  userId: string,
  companyName: string,
  companyEmail: string
): Promise<{ accountUuid: string; userUuid: string }> {
  const client = createTestSupabaseClient();

  // Option 1: Use create_account_with_admin() function (requires proper setup)
  // const { data, error } = await client.rpc('create_account_with_admin', {
  //   p_company_name: companyName,
  //   p_company_email: companyEmail,
  //   p_first_name: 'Test',
  //   p_last_name: 'User'
  // });

  // Option 2: Manual creation for tests (bypassing function for flexibility)
  // Create account
  const { data: account, error: accountError } = await client
    .from('accounts')
    .insert({
      company_name: companyName,
      company_email: companyEmail,
    })
    .select()
    .single();

  if (accountError || !account) {
    throw new Error(`Failed to create test account: ${accountError?.message || 'Unknown error'}`);
  }

  // Create users table entry linking to account
  const { error: userError } = await client.from('users').insert({
    user_uuid: userId,
    account_uuid: account.account_uuid,
    user_email: companyEmail,
    role: 'owner', // First user is owner
  });

  if (userError) {
    // Rollback: delete account
    await client.from('accounts').delete().eq('account_uuid', account.account_uuid);
    throw new Error(`Failed to create user entry: ${userError.message}`);
  }

  console.log(`✓ Created account "${companyName}" for user: ${userId}`);

  return {
    accountUuid: account.account_uuid,
    userUuid: userId,
  };
}

/**
 * Check if user is orphaned
 *
 * @param userId - User ID to check
 * @returns True if orphaned (no users table record or no valid account), false otherwise
 */
export async function isUserOrphaned(userId: string): Promise<boolean> {
  const client = createTestSupabaseClient();

  const { data: userRecord } = await client
    .from('users')
    .select('user_uuid, account_uuid, deleted_at')
    .eq('user_uuid', userId)
    .limit(1)
    .maybeSingle();

  // User is orphaned if:
  // 1. No record in users table
  // 2. account_uuid is null
  // 3. deleted_at is not null (soft deleted)
  if (!userRecord || !userRecord.account_uuid || userRecord.deleted_at) {
    return true;
  }

  // Verify account exists and is not soft-deleted
  const { data: account } = await client
    .from('accounts')
    .select('account_uuid, deleted_at')
    .eq('account_uuid', userRecord.account_uuid)
    .limit(1)
    .maybeSingle();

  // User is orphaned if account doesn't exist or is soft-deleted
  return !account || account.deleted_at !== null;
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
