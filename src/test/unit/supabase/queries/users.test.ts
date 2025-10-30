/**
 * Unit Tests for User Queries
 *
 * Tests user CRUD operations with mocked Supabase client.
 * Tests soft delete pattern, restore functionality, and role-based permissions.
 * RLS policies are tested separately in integration tests.
 *
 * Requirements: FR-005, FR-008 (B2B Schema Query Helpers)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { UserQueries } from '@/core/supabase/queries/users';
import type { User, UserUpdatePayload } from '@/shared/types/database';

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

describe('UserQueries', () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let isMock: ReturnType<typeof vi.fn>;
  let notMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let orderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    maybeSingleMock = vi.fn();
    orderMock = vi.fn();
    selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    notMock = vi.fn(() => ({ select: selectMock, maybeSingle: maybeSingleMock }));
    isMock = vi.fn(() => ({ maybeSingle: maybeSingleMock, order: orderMock, select: selectMock }));
    eqMock = vi.fn(() => ({ is: isMock, not: notMock, select: selectMock, maybeSingle: maybeSingleMock }));
    selectMock = vi.fn(() => ({ eq: eqMock, is: isMock, maybeSingle: maybeSingleMock }));
    updateMock = vi.fn(() => ({ eq: eqMock }));
    fromMock = vi.fn(() => ({
      select: selectMock,
      update: updateMock,
    }));

    (supabase.from as Mock) = fromMock;
  });

  describe('getUser', () => {
    it('should fetch user by UUID successfully', async () => {
      const mockUser: User = {
        user_uuid: '123e4567-e89b-12d3-a456-426614174000',
        account_uuid: 'account-123',
        user_email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: null,
        role: 'member',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockUser, error: null });

      const result = await UserQueries.getUser('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockUser);
      expect(fromMock).toHaveBeenCalledWith('users');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('user_uuid', '123e4567-e89b-12d3-a456-426614174000');
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should return null when user not found', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await UserQueries.getUser('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should filter out soft-deleted users', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      await UserQueries.getUser('deleted-user-uuid');

      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw error when database query fails', async () => {
      const dbError = { message: 'Database connection failed', code: '500' };
      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      await expect(UserQueries.getUser('123')).rejects.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current authenticated user successfully', async () => {
      const mockAuthUser = { id: 'user-123' };
      const mockUser: User = {
        user_uuid: 'user-123',
        account_uuid: 'account-123',
        user_email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: null,
        role: 'owner',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });
      maybeSingleMock.mockResolvedValue({ data: mockUser, error: null });

      const result = await UserQueries.getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('user_uuid', 'user-123');
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw error when user not authenticated', async () => {
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      await expect(UserQueries.getCurrentUser()).rejects.toThrow();
    });

    it('should return null when user profile not found', async () => {
      const mockAuthUser = { id: 'user-123' };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await UserQueries.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('listAccountUsers', () => {
    it('should list users for an account', async () => {
      const mockUsers: User[] = [
        {
          user_uuid: 'user-1',
          account_uuid: 'account-123',
          user_email: 'user1@example.com',
          first_name: 'User',
          last_name: 'One',
          avatar_url: null,
          role: 'owner',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          deleted_at: null,
        },
        {
          user_uuid: 'user-2',
          account_uuid: 'account-123',
          user_email: 'user2@example.com',
          first_name: 'User',
          last_name: 'Two',
          avatar_url: null,
          role: 'member',
          created_at: '2025-01-02T00:00:00Z',
          modified_at: '2025-01-02T00:00:00Z',
          deleted_at: null,
        },
      ];

      orderMock.mockResolvedValue({ data: mockUsers, error: null });

      const result = await UserQueries.listAccountUsers('account-123');

      expect(result).toEqual(mockUsers);
      expect(fromMock).toHaveBeenCalledWith('users');
      expect(eqMock).toHaveBeenCalledWith('account_uuid', 'account-123');
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should return empty array when account has no users', async () => {
      orderMock.mockResolvedValue({ data: [], error: null });

      const result = await UserQueries.listAccountUsers('account-123');

      expect(result).toEqual([]);
    });

    it('should filter out soft-deleted users', async () => {
      orderMock.mockResolvedValue({ data: [], error: null });

      await UserQueries.listAccountUsers('account-123');

      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userUuid = '123e4567-e89b-12d3-a456-426614174000';
      const payload: Omit<UserUpdatePayload, 'user_uuid'> = {
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'admin',
      };
      const updatedUser: User = {
        user_uuid: userUuid,
        account_uuid: 'account-123',
        user_email: 'jane@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        avatar_url: null,
        role: 'admin',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-02T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: updatedUser, error: null });

      const result = await UserQueries.updateUser(userUuid, payload);

      expect(result).toEqual(updatedUser);
      expect(updateMock).toHaveBeenCalledWith(payload);
      expect(eqMock).toHaveBeenCalledWith('user_uuid', userUuid);
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should return null when user not found', async () => {
      const userUuid = 'nonexistent-id';
      const payload: Omit<UserUpdatePayload, 'user_uuid'> = {
        first_name: 'Jane',
      };

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await UserQueries.updateUser(userUuid, payload);

      expect(result).toBeNull();
    });

    it('should handle role updates with RLS enforcement', async () => {
      const userUuid = 'user-123';
      const payload: Omit<UserUpdatePayload, 'user_uuid'> = {
        role: 'admin',
      };

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      await UserQueries.updateUser(userUuid, payload);

      expect(updateMock).toHaveBeenCalledWith(payload);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user successfully', async () => {
      const userUuid = '123e4567-e89b-12d3-a456-426614174000';

      isMock.mockResolvedValue({ error: null });

      await UserQueries.deleteUser(userUuid);

      expect(fromMock).toHaveBeenCalledWith('users');
      expect(updateMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('user_uuid', userUuid);
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);

      // Verify soft delete: update sets deleted_at timestamp
      const updateCall = updateMock.mock.calls[0][0];
      expect(updateCall).toHaveProperty('deleted_at');
      expect(updateCall.deleted_at).toBeTruthy();
    });

    it('should only delete non-deleted users', async () => {
      const userUuid = 'user-123';

      isMock.mockResolvedValue({ error: null });

      await UserQueries.deleteUser(userUuid);

      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw error when RLS denies deletion', async () => {
      const userUuid = '123';
      const rlsError = { message: 'Permission denied', code: '42501' };

      isMock.mockResolvedValue({ error: rlsError });

      await expect(UserQueries.deleteUser(userUuid)).rejects.toThrow();
    });
  });

  describe('restoreUser', () => {
    it('should restore soft-deleted user successfully', async () => {
      const userUuid = '123e4567-e89b-12d3-a456-426614174000';
      const restoredUser: User = {
        user_uuid: userUuid,
        account_uuid: 'account-123',
        user_email: 'restored@example.com',
        first_name: 'Restored',
        last_name: 'User',
        avatar_url: null,
        role: 'member',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-02T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: restoredUser, error: null });

      const result = await UserQueries.restoreUser(userUuid);

      expect(result).toEqual(restoredUser);
      expect(fromMock).toHaveBeenCalledWith('users');
      expect(updateMock).toHaveBeenCalledWith({ deleted_at: null });
      expect(eqMock).toHaveBeenCalledWith('user_uuid', userUuid);
      expect(notMock).toHaveBeenCalledWith('deleted_at', 'is', null);
    });

    it('should return null when user not found', async () => {
      const userUuid = 'nonexistent-id';

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await UserQueries.restoreUser(userUuid);

      expect(result).toBeNull();
    });

    it('should only restore currently deleted users', async () => {
      const userUuid = 'user-123';

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      await UserQueries.restoreUser(userUuid);

      expect(notMock).toHaveBeenCalledWith('deleted_at', 'is', null);
    });

    it('should throw error when RLS denies restoration', async () => {
      const userUuid = '123';
      const rlsError = { message: 'Permission denied', code: '42501' };

      maybeSingleMock.mockResolvedValue({ data: null, error: rlsError });

      await expect(UserQueries.restoreUser(userUuid)).rejects.toThrow();
    });
  });
});
