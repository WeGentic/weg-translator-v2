/**
 * User avatar storage operations
 * @module core/storage/profiles
 */

import { supabase } from '@/core/config/supabaseClient';
import { validateImageFile, getFileExtension } from './validation';

/**
 * Maximum file size for user avatars (1MB)
 */
const MAX_AVATAR_SIZE = 1 * 1024 * 1024;

/**
 * Storage bucket name for user avatars
 */
const USER_AVATARS_BUCKET = 'user-avatars';

/**
 * Default placeholder avatar URL
 */
const DEFAULT_AVATAR_PLACEHOLDER = '/assets/default-avatar.png';

/**
 * URL cache for signed URLs
 * Key: storage path, Value: { url: string, expiresAt: number }
 */
const urlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Upload user avatar to storage
 * @param userId - User UUID
 * @param file - Avatar file to upload
 * @returns Storage path on success, null on failure
 */
export async function uploadUserAvatar(
  userId: string,
  file: File,
): Promise<string | null> {
  try {
    // Validate file
    validateImageFile(file, { maxSize: MAX_AVATAR_SIZE });

    // Generate storage path
    const ext = getFileExtension(file);
    const path = `${userId}/avatar.${ext}`;

    console.log(`[Storage] Uploading user avatar: ${path}`, {
      size: file.size,
      type: file.type,
    });

    // Upload to storage (upsert to overwrite existing)
    const { data, error } = await supabase.storage
      .from(USER_AVATARS_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      console.error('[Storage] Avatar upload failed:', error);
      throw error;
    }

    console.log('[Storage] Avatar uploaded successfully:', data.path);

    // Update database with avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: data.path })
      .eq('id', userId);

    if (updateError) {
      console.error('[Storage] Failed to update profile avatar_url:', updateError);
      // Don't throw - file is uploaded, database update is secondary
    }

    // Clear cached URL for this user
    clearCachedAvatarUrl(userId);

    return data.path;
  } catch (error) {
    console.error('[Storage] User avatar upload failed:', error);
    return null;
  }
}

/**
 * Generate signed URL for user avatar
 * @param avatarPath - Storage path (e.g., "user-id/avatar.png")
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL or placeholder URL if not found
 */
export async function getUserAvatarUrl(
  avatarPath: string | null,
  expiresIn: number = 3600,
): Promise<string> {
  // Return placeholder if no path
  if (!avatarPath) {
    return DEFAULT_AVATAR_PLACEHOLDER;
  }

  // Check cache
  const cached = urlCache.get(avatarPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(USER_AVATARS_BUCKET)
      .createSignedUrl(avatarPath, expiresIn);

    if (error) {
      console.warn('[Storage] Failed to generate signed URL for avatar:', error);
      return DEFAULT_AVATAR_PLACEHOLDER;
    }

    if (!data.signedUrl) {
      console.warn('[Storage] No signed URL returned for:', avatarPath);
      return DEFAULT_AVATAR_PLACEHOLDER;
    }

    // Cache URL (expire 5 minutes before actual expiration for safety)
    const expiresAt = Date.now() + (expiresIn - 300) * 1000;
    urlCache.set(avatarPath, { url: data.signedUrl, expiresAt });

    return data.signedUrl;
  } catch (error) {
    console.error('[Storage] Error generating avatar signed URL:', error);
    return DEFAULT_AVATAR_PLACEHOLDER;
  }
}

/**
 * Delete user avatar from storage
 * @param userId - User UUID
 * @returns True if deleted successfully
 */
export async function deleteUserAvatar(userId: string): Promise<boolean> {
  try {
    // Find all files for this user
    const { data: files, error: listError } = await supabase.storage
      .from(USER_AVATARS_BUCKET)
      .list(userId);

    if (listError) {
      console.error('[Storage] Failed to list user avatars:', listError);
      return false;
    }

    if (!files || files.length === 0) {
      console.log('[Storage] No avatar files found for user:', userId);
      return true;
    }

    // Delete all files for this user
    const filePaths = files.map(file => `${userId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(USER_AVATARS_BUCKET)
      .remove(filePaths);

    if (deleteError) {
      console.error('[Storage] Failed to delete user avatars:', deleteError);
      return false;
    }

    console.log('[Storage] User avatars deleted:', filePaths);

    // Update database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (updateError) {
      console.error('[Storage] Failed to clear profile avatar_url:', updateError);
    }

    // Clear cache
    clearCachedAvatarUrl(userId);

    return true;
  } catch (error) {
    console.error('[Storage] Error deleting user avatar:', error);
    return false;
  }
}

/**
 * Clear cached avatar URL for a user
 * @param userId - User UUID
 */
function clearCachedAvatarUrl(userId: string): void {
  // Remove all cached URLs for this user
  for (const [path] of urlCache.entries()) {
    if (path.startsWith(`${userId}/`)) {
      urlCache.delete(path);
    }
  }
}

/**
 * Clear all expired URLs from cache
 */
export function clearExpiredAvatarUrls(): void {
  const now = Date.now();
  for (const [path, cached] of urlCache.entries()) {
    if (cached.expiresAt <= now) {
      urlCache.delete(path);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(clearExpiredAvatarUrls, 5 * 60 * 1000);
}
