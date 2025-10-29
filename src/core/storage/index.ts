/**
 * Storage operations for Supabase Storage buckets
 * @module core/storage
 */

// Company logos
export {
  uploadCompanyLogo,
  getCompanyLogoUrl,
  deleteCompanyLogo,
  clearExpiredLogoUrls,
} from './companies';

// User avatars
export {
  uploadUserAvatar,
  getUserAvatarUrl,
  deleteUserAvatar,
  clearExpiredAvatarUrls,
} from './profiles';

// Validation utilities
export {
  validateImageFile,
  getFileExtension,
  formatFileSize,
  FileValidationError,
  ALLOWED_IMAGE_TYPES,
  type FileValidationOptions,
} from './validation';
