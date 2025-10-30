/**
 * Type-safe query helpers for account CRUD operations.
 * Uses Supabase client for direct cloud database access with RLS enforcement.
 * All queries filter by deleted_at IS NULL for soft delete pattern.
 */

import { supabase } from '@/core/config/supabaseClient';
import type {
  Account,
  AccountUpdatePayload,
} from '@/shared/types/database';
import {
  generateCorrelationId,
  logOperationError,
  mapSupabaseError,
  type UserFriendlyError,
} from '../errors';

/**
 * Static methods for account database operations.
 * All methods use authenticated Supabase client with RLS policy enforcement.
 * Soft delete pattern: All queries filter deleted_at IS NULL.
 */
export class AccountQueries {
  /**
   * Fetch a single account by UUID.
   * RLS: User must be a member of the account to view it (via JWT claims).
   * Filters out soft-deleted accounts (deleted_at IS NULL).
   *
   * @param accountUuid - UUID of the account
   * @returns Account record or null if not found or soft-deleted
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const account = await AccountQueries.getAccount('123e4567-e89b-12d3-a456-426614174000');
   * if (account) {
   *   console.log('Account:', account.company_name);
   * }
   * ```
   */
  static async getAccount(accountUuid: string): Promise<Account | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_uuid', accountUuid)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('getAccount', userError, { accountUuid });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getAccount', userError, { accountUuid });
      throw userError;
    }
  }

  /**
   * List all accounts for the current authenticated user.
   * Uses RLS policies to filter accounts based on user's account_uuid in JWT claims.
   * Only returns active accounts (deleted_at IS NULL).
   *
   * @returns Array of accounts the user has access to
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const accounts = await AccountQueries.listUserAccounts();
   * console.log(`User has access to ${accounts.length} accounts`);
   * ```
   */
  static async listUserAccounts(): Promise<Account[]> {
    const correlationId = generateCorrelationId();

    try {
      // Get current user to verify authentication
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        const userError = mapSupabaseError(
          authError || new Error('Not authenticated'),
          correlationId
        );
        logOperationError('listUserAccounts', userError, {
          reason: 'User not authenticated',
        });
        throw userError;
      }

      // Query accounts with RLS filtering by account_uuid from JWT claims
      // RLS policies automatically filter to accounts user has access to
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('listUserAccounts', userError, { userId: user.id });
        throw userError;
      }

      return data || [];
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('listUserAccounts', userError);
      throw userError;
    }
  }

  /**
   * Update an existing account.
   * RLS: User must be owner or admin to update account data.
   * modified_at timestamp is automatically updated by database trigger.
   *
   * @param accountUuid - UUID of the account to update
   * @param payload - Account update data (company_name, company_email)
   * @returns Updated account record or null if not found/unauthorized
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const updated = await AccountQueries.updateAccount(
   *   '123e4567-e89b-12d3-a456-426614174000',
   *   {
   *     company_name: 'Acme Corporation',
   *     company_email: 'contact@acme.com',
   *   }
   * );
   * ```
   */
  static async updateAccount(
    accountUuid: string,
    payload: Omit<AccountUpdatePayload, 'account_uuid'>
  ): Promise<Account | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('account_uuid', accountUuid)
        .is('deleted_at', null)
        .select()
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('updateAccount', userError, { accountUuid });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('updateAccount', userError, { accountUuid });
      throw userError;
    }
  }

  /**
   * Soft delete an account.
   * RLS: Only account owners can delete accounts.
   * Sets deleted_at timestamp to now() instead of hard delete.
   * Cascade: User queries will automatically filter out users from soft-deleted accounts.
   *
   * @param accountUuid - UUID of the account to delete
   * @throws UserFriendlyError if operation fails or user lacks permission
   *
   * @example
   * ```typescript
   * await AccountQueries.deleteAccount('123e4567-e89b-12d3-a456-426614174000');
   * console.log('Account soft-deleted successfully');
   * ```
   */
  static async deleteAccount(accountUuid: string): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('account_uuid', accountUuid)
        .is('deleted_at', null);

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('deleteAccount', userError, { accountUuid });
        throw userError;
      }
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('deleteAccount', userError, { accountUuid });
      throw userError;
    }
  }
}
