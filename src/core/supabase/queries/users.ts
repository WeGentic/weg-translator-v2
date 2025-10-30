/**
 * Type-safe query helpers for user CRUD operations.
 * Uses Supabase client for direct cloud database access with RLS enforcement.
 * All queries filter by deleted_at IS NULL for soft delete pattern.
 * Role-based permissions enforced via RLS policies.
 */

import { supabase } from '@/core/config/supabaseClient';
import type {
  User,
  UserUpdatePayload,
} from '@/shared/types/database';
import {
  generateCorrelationId,
  logOperationError,
  mapSupabaseError,
  type UserFriendlyError,
} from '../errors';

/**
 * Static methods for user database operations.
 * All methods use authenticated Supabase client with RLS policy enforcement.
 * Soft delete pattern: All queries filter deleted_at IS NULL.
 * Role-based permissions: owner/admin can manage users, member/viewer can only read.
 */
export class UserQueries {
  /**
   * Fetch a single user by UUID.
   * RLS: User must be in the same account to view.
   * Filters out soft-deleted users (deleted_at IS NULL).
   *
   * @param userUuid - UUID of the user
   * @returns User record or null if not found or soft-deleted
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const user = await UserQueries.getUser('123e4567-e89b-12d3-a456-426614174000');
   * if (user) {
   *   console.log('User:', user.user_email, 'Role:', user.role);
   * }
   * ```
   */
  static async getUser(userUuid: string): Promise<User | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_uuid', userUuid)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('getUser', userError, { userUuid });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getUser', userError, { userUuid });
      throw userError;
    }
  }

  /**
   * Get the current authenticated user's profile.
   * Returns the full User record including account_uuid and role.
   * Filters out soft-deleted users (deleted_at IS NULL).
   *
   * @returns User record for current authenticated user or null if not found
   * @throws UserFriendlyError if operation fails or user not authenticated
   *
   * @example
   * ```typescript
   * const currentUser = await UserQueries.getCurrentUser();
   * if (currentUser) {
   *   console.log('Logged in as:', currentUser.user_email);
   *   console.log('Account:', currentUser.account_uuid);
   *   console.log('Role:', currentUser.role);
   * }
   * ```
   */
  static async getCurrentUser(): Promise<User | null> {
    const correlationId = generateCorrelationId();

    try {
      // Get current auth user
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        const userError = mapSupabaseError(
          authError || new Error('Not authenticated'),
          correlationId
        );
        logOperationError('getCurrentUser', userError, {
          reason: 'User not authenticated',
        });
        throw userError;
      }

      // Fetch user profile from public.users
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_uuid', authUser.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('getCurrentUser', userError, { userId: authUser.id });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getCurrentUser', userError);
      throw userError;
    }
  }

  /**
   * List all users for a specific account.
   * RLS: User must be in the same account to view members.
   * Returns only active users (deleted_at IS NULL).
   *
   * @param accountUuid - UUID of the account
   * @returns Array of users in the account
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const users = await UserQueries.listAccountUsers('123e4567-e89b-12d3-a456-426614174000');
   * console.log(`Account has ${users.length} active users`);
   * users.forEach(user => console.log(`- ${user.user_email} (${user.role})`));
   * ```
   */
  static async listAccountUsers(accountUuid: string): Promise<User[]> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('account_uuid', accountUuid)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('listAccountUsers', userError, { accountUuid });
        throw userError;
      }

      return data || [];
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('listAccountUsers', userError, { accountUuid });
      throw userError;
    }
  }

  /**
   * Update a user profile.
   * RLS: Users can update their own profile. Owner/admin can update any user in account.
   * Role changes require owner/admin permissions via RLS policies.
   * modified_at timestamp is automatically updated by database trigger.
   *
   * @param userUuid - UUID of the user to update
   * @param payload - User update data (first_name, last_name, avatar_url, role)
   * @returns Updated user record or null if not found/unauthorized
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const updated = await UserQueries.updateUser(
   *   '123e4567-e89b-12d3-a456-426614174000',
   *   {
   *     first_name: 'John',
   *     last_name: 'Doe',
   *     role: 'admin',
   *   }
   * );
   * ```
   */
  static async updateUser(
    userUuid: string,
    payload: Omit<UserUpdatePayload, 'user_uuid'>
  ): Promise<User | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('user_uuid', userUuid)
        .is('deleted_at', null)
        .select()
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('updateUser', userError, { userUuid, payload });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('updateUser', userError, { userUuid });
      throw userError;
    }
  }

  /**
   * Soft delete a user.
   * RLS: Only account owner/admin can delete users.
   * Sets deleted_at timestamp to now() instead of hard delete.
   * User can still authenticate but will be filtered out of queries.
   *
   * @param userUuid - UUID of the user to delete
   * @throws UserFriendlyError if operation fails or user lacks permission
   *
   * @example
   * ```typescript
   * await UserQueries.deleteUser('123e4567-e89b-12d3-a456-426614174000');
   * console.log('User soft-deleted successfully');
   * ```
   */
  static async deleteUser(userUuid: string): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      const { error } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_uuid', userUuid)
        .is('deleted_at', null);

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('deleteUser', userError, { userUuid });
        throw userError;
      }
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('deleteUser', userError, { userUuid });
      throw userError;
    }
  }

  /**
   * Restore a soft-deleted user.
   * RLS: Only account owner/admin can restore users.
   * Sets deleted_at back to null to reactivate the user.
   * User becomes visible in queries again.
   *
   * @param userUuid - UUID of the user to restore
   * @returns Restored user record or null if not found/unauthorized
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const restored = await UserQueries.restoreUser('123e4567-e89b-12d3-a456-426614174000');
   * if (restored) {
   *   console.log('User restored successfully:', restored.user_email);
   * }
   * ```
   */
  static async restoreUser(userUuid: string): Promise<User | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ deleted_at: null })
        .eq('user_uuid', userUuid)
        .not('deleted_at', 'is', null) // Only restore if currently deleted
        .select()
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('restoreUser', userError, { userUuid });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('restoreUser', userError, { userUuid });
      throw userError;
    }
  }
}
