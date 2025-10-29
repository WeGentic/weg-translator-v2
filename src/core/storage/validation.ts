/**
 * Shared validation utilities for file uploads
 * @module core/storage/validation
 */

/**
 * Allowed image MIME types for logos and avatars
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

/**
 * File validation options
 */
export interface FileValidationOptions {
  /**
   * Maximum file size in bytes
   */
  maxSize: number;

  /**
   * Allowed MIME types
   */
  allowedTypes?: readonly string[];
}

/**
 * Validation error with user-friendly messages
 */
export class FileValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_FILE',
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Validate an image file for upload
 * @param file - File to validate
 * @param options - Validation constraints
 * @throws {FileValidationError} If validation fails
 */
export function validateImageFile(
  file: File,
  options: FileValidationOptions,
): void {
  // Check file exists
  if (!file) {
    throw new FileValidationError(
      'No file provided',
      'INVALID_FILE',
    );
  }

  // Check file type
  const allowedTypes = options.allowedTypes || ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file.type as any)) {
    throw new FileValidationError(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      'INVALID_TYPE',
    );
  }

  // Check file size
  if (file.size > options.maxSize) {
    const maxSizeMB = (options.maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new FileValidationError(
      `File too large (${fileSizeMB}MB). Maximum size: ${maxSizeMB}MB`,
      'FILE_TOO_LARGE',
    );
  }
}

/**
 * Extract file extension from File object
 * @param file - File object
 * @returns File extension (e.g., 'png', 'jpg')
 */
export function getFileExtension(file: File): string {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'png';
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
