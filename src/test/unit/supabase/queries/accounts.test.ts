/**
 * Unit Tests for Account Queries
 *
 * Tests account CRUD operations with mocked Supabase client.
 * Tests soft delete pattern and RLS filtering.
 * RLS policies are tested separately in integration tests.
 *
 * Requirements: FR-005, FR-008 (B2B Schema Query Helpers)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { AccountQueries } from '@/core/supabase/queries/accounts';
import type { Account, AccountUpdatePayload } from '@/shared/types/database';

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

describe('AccountQueries', () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let isMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let orderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    maybeSingleMock = vi.fn();
    orderMock = vi.fn();
    selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    isMock = vi.fn(() => ({ maybeSingle: maybeSingleMock, order: orderMock, select: selectMock }));
    eqMock = vi.fn(() => ({ is: isMock, select: selectMock, maybeSingle: maybeSingleMock }));
    updateMock = vi.fn(() => ({ eq: eqMock }));
    selectMock = vi.fn(() => ({ eq: eqMock, is: isMock, maybeSingle: maybeSingleMock }));
    fromMock = vi.fn(() => ({
      select: selectMock,
      update: updateMock,
    }));

    (supabase.from as Mock) = fromMock;
  });

  describe('getAccount', () => {
    it('should fetch account by UUID successfully', async () => {
      const mockAccount: Account = {
        account_uuid: '123e4567-e89b-12d3-a456-426614174000',
        company_name: 'Test Company',
        company_email: 'test@company.com',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: mockAccount, error: null });

      const result = await AccountQueries.getAccount('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockAccount);
      expect(fromMock).toHaveBeenCalledWith('accounts');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('account_uuid', '123e4567-e89b-12d3-a456-426614174000');
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should return null when account not found', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await AccountQueries.getAccount('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should filter out soft-deleted accounts', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      await AccountQueries.getAccount('deleted-account-uuid');

      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw error when database query fails', async () => {
      const dbError = { message: 'Database connection failed', code: '500' };
      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      await expect(AccountQueries.getAccount('123')).rejects.toThrow();
    });

    it('should include correlation ID in errors', async () => {
      const dbError = { message: 'RLS violation', code: '42501' };
      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      try {
        await AccountQueries.getAccount('123');
      } catch (error: any) {
        expect(error.correlationId).toBe('test-correlation-id');
      }
    });
  });

  describe('listUserAccounts', () => {
    it('should list accounts for authenticated user', async () => {
      const mockUser = { id: 'user-123' };
      const mockAccounts: Account[] = [
        {
          account_uuid: 'account-1',
          company_name: 'Company 1',
          company_email: 'c1@test.com',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          deleted_at: null,
        },
        {
          account_uuid: 'account-2',
          company_name: 'Company 2',
          company_email: 'c2@test.com',
          created_at: '2025-01-02T00:00:00Z',
          modified_at: '2025-01-02T00:00:00Z',
          deleted_at: null,
        },
      ];

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      orderMock.mockResolvedValue({ data: mockAccounts, error: null });

      const result = await AccountQueries.listUserAccounts();

      expect(result).toEqual(mockAccounts);
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should return empty array when user has no accounts', async () => {
      const mockUser = { id: 'user-123' };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      orderMock.mockResolvedValue({ data: [], error: null });

      const result = await AccountQueries.listUserAccounts();

      expect(result).toEqual([]);
    });

    it('should throw error when user not authenticated', async () => {
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      await expect(AccountQueries.listUserAccounts()).rejects.toThrow();
    });

    it('should filter out soft-deleted accounts', async () => {
      const mockUser = { id: 'user-123' };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      orderMock.mockResolvedValue({ data: [], error: null });

      await AccountQueries.listUserAccounts();

      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });
  });

  describe('updateAccount', () => {
    it('should update account successfully', async () => {
      const accountUuid = '123e4567-e89b-12d3-a456-426614174000';
      const payload: Omit<AccountUpdatePayload, 'account_uuid'> = {
        company_name: 'Updated Company',
        company_email: 'updated@company.com',
      };
      const updatedAccount: Account = {
        account_uuid: accountUuid,
        company_name: 'Updated Company',
        company_email: 'updated@company.com',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-02T00:00:00Z',
        deleted_at: null,
      };

      maybeSingleMock.mockResolvedValue({ data: updatedAccount, error: null });

      const result = await AccountQueries.updateAccount(accountUuid, payload);

      expect(result).toEqual(updatedAccount);
      expect(updateMock).toHaveBeenCalledWith(payload);
      expect(eqMock).toHaveBeenCalledWith('account_uuid', accountUuid);
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should return null when account not found', async () => {
      const accountUuid = 'nonexistent-id';
      const payload: Omit<AccountUpdatePayload, 'account_uuid'> = {
        company_name: 'Updated Company',
      };

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await AccountQueries.updateAccount(accountUuid, payload);

      expect(result).toBeNull();
    });

    it('should not update soft-deleted accounts', async () => {
      const accountUuid = 'deleted-account-uuid';
      const payload: Omit<AccountUpdatePayload, 'account_uuid'> = {
        company_name: 'Updated Company',
      };

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await AccountQueries.updateAccount(accountUuid, payload);

      expect(result).toBeNull();
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw error on database failure', async () => {
      const accountUuid = '123';
      const payload: Omit<AccountUpdatePayload, 'account_uuid'> = {
        company_name: 'Updated Company',
      };
      const dbError = { message: 'Database error', code: '500' };

      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      await expect(AccountQueries.updateAccount(accountUuid, payload)).rejects.toThrow();
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete account successfully', async () => {
      const accountUuid = '123e4567-e89b-12d3-a456-426614174000';

      isMock.mockResolvedValue({ error: null });

      await AccountQueries.deleteAccount(accountUuid);

      expect(fromMock).toHaveBeenCalledWith('accounts');
      expect(updateMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('account_uuid', accountUuid);
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);

      // Verify soft delete: update sets deleted_at timestamp
      const updateCall = updateMock.mock.calls[0][0];
      expect(updateCall).toHaveProperty('deleted_at');
      expect(updateCall.deleted_at).toBeTruthy();
    });

    it('should only delete non-deleted accounts', async () => {
      const accountUuid = 'account-123';

      isMock.mockResolvedValue({ error: null });

      await AccountQueries.deleteAccount(accountUuid);

      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw error when RLS denies deletion', async () => {
      const accountUuid = '123';
      const rlsError = { message: 'Permission denied', code: '42501' };

      isMock.mockResolvedValue({ error: rlsError });

      await expect(AccountQueries.deleteAccount(accountUuid)).rejects.toThrow();
    });

    it('should throw error on database failure', async () => {
      const accountUuid = '123';
      const dbError = { message: 'Database error', code: '500' };

      isMock.mockResolvedValue({ error: dbError });

      await expect(AccountQueries.deleteAccount(accountUuid)).rejects.toThrow();
    });
  });
});
