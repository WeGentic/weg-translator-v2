/**
 * Type-safe query helpers for user profile CRUD operations.
 * Uses Supabase client for direct cloud database access with RLS enforcement.
 */

import { supabase } from '@/core/config/supabaseClient';
import type { Profile, ProfileUpdatePayload } from '@/shared/types/database';
import {
  generateCorrelationId,
  logOperationError,
  mapSupabaseError,
  type UserFriendlyError,
} from '../errors';

/**
 * Static methods for profile database operations.
 * All methods use authenticated Supabase client with RLS policy enforcement.
 *
 * Note: Profile creation is handled by database trigger (handle_new_user).
 * Only read and update operations are exposed here.
 */
export class ProfileQueries {
  /**
   * Fetch a user profile by ID.
   * RLS: User can view their own profile or profiles of company co-members.
   *
   * @param userId - UUID of the user
   * @returns Profile record or null if not found/unauthorized
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const profile = await ProfileQueries.getProfile('123e4567-e89b-12d3-a456-426614174000');
   * if (profile) {
   *   console.log('User:', profile.full_name);
   * }
   * ```
   */
  static async getProfile(userId: string): Promise<Profile | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('getProfile', userError, { userId });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getProfile', userError, { userId });
      throw userError;
    }
  }

  /**
   * Fetch the current authenticated user's profile.
   * Convenience method that gets current user ID from session.
   * RLS: User can always view their own profile.
   *
   * @returns Profile record or null if user not authenticated or profile not found
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const myProfile = await ProfileQueries.getCurrentUserProfile();
   * if (myProfile) {
   *   console.log('Logged in as:', myProfile.full_name);
   * }
   * ```
   */
  static async getCurrentUserProfile(): Promise<Profile | null> {
    const correlationId = generateCorrelationId();

    try {
      // Get current user from session
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        const userError = mapSupabaseError(
          authError || new Error('Not authenticated'),
          correlationId
        );
        logOperationError('getCurrentUserProfile', userError, {
          reason: 'User not authenticated',
        });
        throw userError;
      }

      // Fetch profile for current user
      return await this.getProfile(user.id);
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getCurrentUserProfile', userError);
      throw userError;
    }
  }

  /**
   * Update a user profile.
   * RLS: User can only update their own profile.
   *
   * @param payload - Profile update data with ID
   * @returns Updated profile record or null if not found/unauthorized
   * @throws UserFriendlyError if operation fails or avatar_url is invalid
   *
   * @example
   * ```typescript
   * const updated = await ProfileQueries.updateProfile({
   *   id: '123e4567-e89b-12d3-a456-426614174000',
   *   full_name: 'John Doe',
   *   avatar_url: 'user-avatars/123e4567-e89b-12d3-a456-426614174000/avatar.png',
   * });
   * ```
   */
  static async updateProfile(
    payload: ProfileUpdatePayload
  ): Promise<Profile | null> {
    const correlationId = generateCorrelationId();
    const { id, ...updates } = payload;

    try {
      // Validate avatar_url if provided
      if (updates.avatar_url !== undefined && updates.avatar_url !== null) {
        this.validateAvatarUrl(updates.avatar_url);
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('updateProfile', userError, { userId: id });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('updateProfile', userError, { userId: id });
      throw userError;
    }
  }

  /**
   * Validates that an avatar URL is a valid Supabase Storage path.
   * Accepts paths in format: "user-avatars/{userId}/avatar.{ext}"
   *
   * @param avatarUrl - The avatar URL to validate
   * @throws Error if URL format is invalid
   */
  private static validateAvatarUrl(avatarUrl: string): void {
    // Accept empty strings (will be stored as null)
    if (avatarUrl.trim() === '') {
      return;
    }

    // Validate format: should be a storage path, not a full URL
    // Expected format: user-avatars/{uuid}/avatar.{ext}
    const storagePathRegex = /^user-avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+\.(png|jpg|jpeg|webp)$/i;

    if (!storagePathRegex.test(avatarUrl)) {
      throw new Error(
        'Invalid avatar URL format. Expected: user-avatars/{userId}/avatar.{ext}'
      );
    }
  }
}
