/**
 * Company logo storage operations
 * @module core/storage/companies
 */

import { supabase } from '@/core/config/supabaseClient';
import { validateImageFile, getFileExtension } from './validation';

/**
 * Maximum file size for company logos (2MB)
 */
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

/**
 * Storage bucket name for company logos
 */
const COMPANY_LOGOS_BUCKET = 'company-logos';

/**
 * Default placeholder logo URL
 */
const DEFAULT_LOGO_PLACEHOLDER = '/assets/default-company-logo.png';

/**
 * URL cache for signed URLs
 * Key: storage path, Value: { url: string, expiresAt: number }
 */
const urlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Upload company logo to storage
 * @param companyId - Company UUID
 * @param file - Logo file to upload
 * @returns Storage path on success, null on failure
 */
export async function uploadCompanyLogo(
  companyId: string,
  file: File,
): Promise<string | null> {
  try {
    // Validate file
    validateImageFile(file, { maxSize: MAX_LOGO_SIZE });

    // Generate storage path
    const ext = getFileExtension(file);
    const path = `${companyId}/logo.${ext}`;

    console.log(`[Storage] Uploading company logo: ${path}`, {
      size: file.size,
      type: file.type,
    });

    // Upload to storage (upsert to overwrite existing)
    const { data, error } = await supabase.storage
      .from(COMPANY_LOGOS_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      console.error('[Storage] Logo upload failed:', error);
      throw error;
    }

    console.log('[Storage] Logo uploaded successfully:', data.path);

    // Update database with logo URL
    const { error: updateError } = await supabase
      .from('companies')
      .update({ logo_url: data.path })
      .eq('id', companyId);

    if (updateError) {
      console.error('[Storage] Failed to update company logo_url:', updateError);
      // Don't throw - file is uploaded, database update is secondary
    }

    // Clear cached URL for this company
    clearCachedLogoUrl(companyId);

    return data.path;
  } catch (error) {
    console.error('[Storage] Company logo upload failed:', error);
    return null;
  }
}

/**
 * Generate signed URL for company logo
 * @param logoPath - Storage path (e.g., "company-id/logo.png")
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL or placeholder URL if not found
 */
export async function getCompanyLogoUrl(
  logoPath: string | null,
  expiresIn: number = 3600,
): Promise<string> {
  // Return placeholder if no path
  if (!logoPath) {
    return DEFAULT_LOGO_PLACEHOLDER;
  }

  // Check cache
  const cached = urlCache.get(logoPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(COMPANY_LOGOS_BUCKET)
      .createSignedUrl(logoPath, expiresIn);

    if (error) {
      console.warn('[Storage] Failed to generate signed URL for logo:', error);
      return DEFAULT_LOGO_PLACEHOLDER;
    }

    if (!data.signedUrl) {
      console.warn('[Storage] No signed URL returned for:', logoPath);
      return DEFAULT_LOGO_PLACEHOLDER;
    }

    // Cache URL (expire 5 minutes before actual expiration for safety)
    const expiresAt = Date.now() + (expiresIn - 300) * 1000;
    urlCache.set(logoPath, { url: data.signedUrl, expiresAt });

    return data.signedUrl;
  } catch (error) {
    console.error('[Storage] Error generating logo signed URL:', error);
    return DEFAULT_LOGO_PLACEHOLDER;
  }
}

/**
 * Delete company logo from storage
 * @param companyId - Company UUID
 * @returns True if deleted successfully
 */
export async function deleteCompanyLogo(companyId: string): Promise<boolean> {
  try {
    // Find all files for this company
    const { data: files, error: listError } = await supabase.storage
      .from(COMPANY_LOGOS_BUCKET)
      .list(companyId);

    if (listError) {
      console.error('[Storage] Failed to list company logos:', listError);
      return false;
    }

    if (!files || files.length === 0) {
      console.log('[Storage] No logo files found for company:', companyId);
      return true;
    }

    // Delete all files for this company
    const filePaths = files.map(file => `${companyId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(COMPANY_LOGOS_BUCKET)
      .remove(filePaths);

    if (deleteError) {
      console.error('[Storage] Failed to delete company logos:', deleteError);
      return false;
    }

    console.log('[Storage] Company logos deleted:', filePaths);

    // Update database
    const { error: updateError } = await supabase
      .from('companies')
      .update({ logo_url: null })
      .eq('id', companyId);

    if (updateError) {
      console.error('[Storage] Failed to clear company logo_url:', updateError);
    }

    // Clear cache
    clearCachedLogoUrl(companyId);

    return true;
  } catch (error) {
    console.error('[Storage] Error deleting company logo:', error);
    return false;
  }
}

/**
 * Clear cached logo URL for a company
 * @param companyId - Company UUID
 */
function clearCachedLogoUrl(companyId: string): void {
  // Remove all cached URLs for this company
  for (const [path] of urlCache.entries()) {
    if (path.startsWith(`${companyId}/`)) {
      urlCache.delete(path);
    }
  }
}

/**
 * Clear all expired URLs from cache
 */
export function clearExpiredLogoUrls(): void {
  const now = Date.now();
  for (const [path, cached] of urlCache.entries()) {
    if (cached.expiresAt <= now) {
      urlCache.delete(path);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(clearExpiredLogoUrls, 5 * 60 * 1000);
}
