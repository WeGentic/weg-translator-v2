/**
 * Unit Tests for Profile Queries
 *
 * Tests user profile operations with mocked Supabase client.
 * RLS policies are tested separately in integration tests.
 *
 * Requirements: Req #26 (Unit Testing)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ProfileQueries } from '@/core/supabase/queries/profiles';
import type { Profile, ProfileUpdatePayload } from '@/shared/types/database';

// Mock Supabase client
vi.mock('@/core/config/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock error utilities
vi.mock('@/core/supabase/errors', () => ({
  generateCorrelationId: vi.fn(() => 'test-correlation-id'),
  logOperationError: vi.fn(),
  mapSupabaseError: vi.fn((error) => ({
    type: 'database',
    message: error.message || 'Database error',
    correlationId: 'test-correlation-id',
  })),
}));

import { supabase } from '@/core/config/supabaseClient';

describe('ProfileQueries', () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    maybeSingleMock = vi.fn();
    eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock, select: selectMock }));
    selectMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock }));
    updateMock = vi.fn(() => ({ eq: eqMock }));
    fromMock = vi.fn(() => ({
      select: selectMock,
      update: updateMock,
    }));

    (supabase.from as Mock) = fromMock;
  });

  describe('getProfile', () => {
    it('should fetch profile by user ID successfully', async () => {
      const mockProfile: Profile = {
        id: 'user-123',
        full_name: 'John Doe',
        avatar_url: 'user-avatars/user-123/avatar.png',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockProfile, error: null });

      const result = await ProfileQueries.getProfile('user-123');

      expect(result).toEqual(mockProfile);
      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should return null when profile not found', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await ProfileQueries.getProfile('nonexistent-user');

      expect(result).toBeNull();
    });

    it('should throw error when database query fails', async () => {
      const dbError = { message: 'Connection timeout', code: '500' };
      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      await expect(ProfileQueries.getProfile('user-123')).rejects.toThrow();
    });
  });

  describe('getCurrentUserProfile', () => {
    it('should fetch current user profile successfully', async () => {
      const mockUser = { id: 'current-user-id' };
      const mockProfile: Profile = {
        id: 'current-user-id',
        full_name: 'Current User',
        avatar_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      maybeSingleMock.mockResolvedValue({ data: mockProfile, error: null });

      const result = await ProfileQueries.getCurrentUserProfile();

      expect(result).toEqual(mockProfile);
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(eqMock).toHaveBeenCalledWith('id', 'current-user-id');
    });

    it('should throw error when user not authenticated', async () => {
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      await expect(ProfileQueries.getCurrentUserProfile()).rejects.toThrow();
    });
  });

  describe('updateProfile', () => {
    it('should update profile with valid data', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        full_name: 'Updated Name',
      };

      const mockUpdatedProfile: Profile = {
        id: 'user-123',
        full_name: 'Updated Name',
        avatar_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockUpdatedProfile, error: null });

      const result = await ProfileQueries.updateProfile(payload);

      expect(result).toEqual(mockUpdatedProfile);
      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(updateMock).toHaveBeenCalledWith({ full_name: 'Updated Name' });
      expect(eqMock).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should update profile with valid avatar URL', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.png',
      };

      const mockUpdatedProfile: Profile = {
        id: 'user-123',
        full_name: 'John Doe',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.png',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockUpdatedProfile, error: null });

      const result = await ProfileQueries.updateProfile(payload);

      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should throw error for invalid avatar URL format', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'https://example.com/invalid-path.png',
      };

      await expect(ProfileQueries.updateProfile(payload)).rejects.toThrow(/Invalid avatar URL format/);
    });

    it('should accept empty string avatar URL', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: '',
      };

      const mockUpdatedProfile: Profile = {
        id: 'user-123',
        full_name: 'John Doe',
        avatar_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockUpdatedProfile, error: null });

      const result = await ProfileQueries.updateProfile(payload);

      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should return null when profile not found or unauthorized', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'nonexistent',
        full_name: 'Attempted Update',
      };

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await ProfileQueries.updateProfile(payload);

      expect(result).toBeNull();
    });

    it('should handle both full_name and avatar_url updates', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        full_name: 'New Name',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.jpg',
      };

      const mockUpdatedProfile: Profile = {
        id: 'user-123',
        full_name: 'New Name',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.jpg',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockUpdatedProfile, error: null });

      const result = await ProfileQueries.updateProfile(payload);

      expect(result).toEqual(mockUpdatedProfile);
      expect(updateMock).toHaveBeenCalledWith({
        full_name: 'New Name',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.jpg',
      });
    });
  });

  describe('Avatar URL Validation', () => {
    it('should accept valid avatar URL with PNG extension', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.png',
      };

      maybeSingleMock.mockResolvedValue({ data: {} as Profile, error: null });

      await expect(ProfileQueries.updateProfile(payload)).resolves.toBeDefined();
    });

    it('should accept valid avatar URL with JPG extension', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.jpg',
      };

      maybeSingleMock.mockResolvedValue({ data: {} as Profile, error: null });

      await expect(ProfileQueries.updateProfile(payload)).resolves.toBeDefined();
    });

    it('should accept valid avatar URL with WEBP extension', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/photo.webp',
      };

      maybeSingleMock.mockResolvedValue({ data: {} as Profile, error: null });

      await expect(ProfileQueries.updateProfile(payload)).resolves.toBeDefined();
    });

    it('should reject avatar URL without valid UUID', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'user-avatars/invalid-uuid/avatar.png',
      };

      await expect(ProfileQueries.updateProfile(payload)).rejects.toThrow(/Invalid avatar URL format/);
    });

    it('should reject avatar URL with invalid extension', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'user-avatars/12345678-1234-1234-1234-123456789abc/avatar.pdf',
      };

      await expect(ProfileQueries.updateProfile(payload)).rejects.toThrow(/Invalid avatar URL format/);
    });

    it('should reject avatar URL with wrong bucket', async () => {
      const payload: ProfileUpdatePayload = {
        id: 'user-123',
        avatar_url: 'company-logos/12345678-1234-1234-1234-123456789abc/logo.png',
      };

      await expect(ProfileQueries.updateProfile(payload)).rejects.toThrow(/Invalid avatar URL format/);
    });
  });
});
