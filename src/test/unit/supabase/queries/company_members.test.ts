/**
 * Unit Tests for Company Membership Queries
 *
 * Tests company membership operations with mocked Supabase client.
 * RLS policies and role-based access are tested separately in integration tests.
 *
 * Requirements: Req #26 (Unit Testing)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { MembershipQueries } from '@/core/supabase/queries/company_members';
import type { CompanyMember, InviteMemberPayload, UpdateMemberRolePayload } from '@/shared/types/database';

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
    message: error?.message || 'Database error',
    correlationId: 'test-correlation-id',
  })),
}));

import { supabase } from '@/core/config/supabaseClient';

describe('MembershipQueries', () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let orderMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;
  let singleMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let deleteMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    maybeSingleMock = vi.fn();
    singleMock = vi.fn();
    orderMock = vi.fn(() => Promise.resolve({ data: [], error: null }));
    eqMock = vi.fn(() => ({
      maybeSingle: maybeSingleMock,
      select: selectMock,
      order: orderMock,
      eq: eqMock,
    }));
    selectMock = vi.fn(() => ({
      eq: eqMock,
      maybeSingle: maybeSingleMock,
      single: singleMock,
    }));
    insertMock = vi.fn(() => ({ select: selectMock }));
    updateMock = vi.fn(() => ({ eq: eqMock }));
    deleteMock = vi.fn(() => ({ eq: eqMock }));
    fromMock = vi.fn(() => ({
      select: selectMock,
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
    }));

    (supabase.from as Mock) = fromMock;
  });

  describe('listCompanyMembers', () => {
    it('should list all members of a company', async () => {
      const mockMembers: CompanyMember[] = [
        {
          id: 'member-1',
          company_id: 'company-123',
          user_id: 'user-1',
          role: 'owner',
          invited_by: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'member-2',
          company_id: 'company-123',
          user_id: 'user-2',
          role: 'admin',
          invited_by: 'user-1',
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      orderMock.mockResolvedValue({ data: mockMembers, error: null });

      const result = await MembershipQueries.listCompanyMembers('company-123');

      expect(result).toEqual(mockMembers);
      expect(fromMock).toHaveBeenCalledWith('company_members');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('company_id', 'company-123');
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should return empty array when company has no members (RLS filtered)', async () => {
      orderMock.mockResolvedValue({ data: [], error: null });

      const result = await MembershipQueries.listCompanyMembers('empty-company');

      expect(result).toEqual([]);
    });

    it('should throw error when database query fails', async () => {
      const dbError = { message: 'Connection failed', code: '500' };
      orderMock.mockResolvedValue({ data: null, error: dbError });

      await expect(MembershipQueries.listCompanyMembers('company-123')).rejects.toThrow();
    });
  });

  describe('inviteMember', () => {
    it('should invite member as owner', async () => {
      const mockUser = { id: 'owner-user-id' };
      const payload: InviteMemberPayload = {
        company_id: 'company-123',
        user_id: 'new-user-id',
        role: 'member',
      };

      const mockCreatedMember: CompanyMember = {
        id: 'new-member-id',
        company_id: 'company-123',
        user_id: 'new-user-id',
        role: 'member',
        invited_by: 'owner-user-id',
        created_at: '2025-01-03T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
      };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      singleMock.mockResolvedValue({ data: mockCreatedMember, error: null });

      const result = await MembershipQueries.inviteMember(payload);

      expect(result).toEqual(mockCreatedMember);
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith('company_members');
      expect(insertMock).toHaveBeenCalledWith({
        ...payload,
        invited_by: 'owner-user-id',
      });
    });

    it('should throw error when user not authenticated', async () => {
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const payload: InviteMemberPayload = {
        company_id: 'company-123',
        user_id: 'new-user-id',
        role: 'member',
      };

      await expect(MembershipQueries.inviteMember(payload)).rejects.toThrow();
    });

    it('should throw error for duplicate membership', async () => {
      const mockUser = { id: 'owner-user-id' };
      const payload: InviteMemberPayload = {
        company_id: 'company-123',
        user_id: 'existing-user-id',
        role: 'member',
      };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const duplicateError = { message: 'duplicate key value', code: '23505' };
      singleMock.mockResolvedValue({ data: null, error: duplicateError });

      await expect(MembershipQueries.inviteMember(payload)).rejects.toThrow();
    });

    it('should invite member as admin', async () => {
      const mockUser = { id: 'admin-user-id' };
      const payload: InviteMemberPayload = {
        company_id: 'company-123',
        user_id: 'new-user-id',
        role: 'member',
      };

      const mockCreatedMember: CompanyMember = {
        id: 'new-member-id',
        company_id: 'company-123',
        user_id: 'new-user-id',
        role: 'member',
        invited_by: 'admin-user-id',
        created_at: '2025-01-03T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
      };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      singleMock.mockResolvedValue({ data: mockCreatedMember, error: null });

      const result = await MembershipQueries.inviteMember(payload);

      expect(result).toEqual(mockCreatedMember);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role as owner', async () => {
      const payload: UpdateMemberRolePayload = {
        member_id: 'member-123',
        new_role: 'admin',
      };

      const mockUpdatedMember: CompanyMember = {
        id: 'member-123',
        company_id: 'company-123',
        user_id: 'user-123',
        role: 'admin',
        invited_by: 'owner-user-id',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockUpdatedMember, error: null });

      const result = await MembershipQueries.updateMemberRole(payload);

      expect(result).toEqual(mockUpdatedMember);
      expect(fromMock).toHaveBeenCalledWith('company_members');
      expect(updateMock).toHaveBeenCalledWith({ role: 'admin' });
      expect(eqMock).toHaveBeenCalledWith('id', 'member-123');
    });

    it('should return null when member not found or unauthorized', async () => {
      const payload: UpdateMemberRolePayload = {
        member_id: 'nonexistent-member',
        new_role: 'admin',
      };

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await MembershipQueries.updateMemberRole(payload);

      expect(result).toBeNull();
    });

    it('should handle role promotion from member to admin', async () => {
      const payload: UpdateMemberRolePayload = {
        member_id: 'member-123',
        new_role: 'admin',
      };

      const mockUpdatedMember: CompanyMember = {
        id: 'member-123',
        company_id: 'company-123',
        user_id: 'user-123',
        role: 'admin',
        invited_by: 'owner-user-id',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockUpdatedMember, error: null });

      const result = await MembershipQueries.updateMemberRole(payload);

      expect(result?.role).toBe('admin');
    });
  });

  describe('removeMember', () => {
    it('should remove non-owner member', async () => {
      const membershipData = {
        company_id: 'company-123',
        role: 'member',
      };

      // First query chain for fetching membership
      const fetchEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
      const fetchSelectMock = vi.fn(() => ({ eq: fetchEqMock }));
      const fetchFromMock = vi.fn(() => ({ select: fetchSelectMock }));

      // First call to fetch membership
      maybeSingleMock.mockResolvedValueOnce({ data: membershipData, error: null });

      // Second query chain for delete
      const deleteEqChainMock = vi.fn(() => Promise.resolve({ error: null }));
      const deleteEqMock = vi.fn(() => deleteEqChainMock());
      const deleteFromMock = vi.fn(() => ({ delete: vi.fn(() => ({ eq: deleteEqMock })) }));

      // Mock fromMock to return appropriate chain based on call
      let callCount = 0;
      fromMock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: fetchSelectMock };
        } else {
          return { delete: vi.fn(() => ({ eq: deleteEqMock })) };
        }
      });

      await MembershipQueries.removeMember('member-123');

      expect(fromMock).toHaveBeenCalledWith('company_members');
    });

    it('should throw error when attempting to remove last owner', async () => {
      const membershipData = {
        company_id: 'company-123',
        role: 'owner',
      };

      const ownersData = [{ id: 'member-123' }]; // Only one owner

      // First call to fetch membership
      maybeSingleMock.mockResolvedValueOnce({ data: membershipData, error: null });

      // Second call to check owners count
      eqMock.mockImplementationOnce(() => ({
        eq: vi.fn(() => Promise.resolve({ data: ownersData, error: null })),
      }));

      await expect(MembershipQueries.removeMember('member-123')).rejects.toThrow(/Cannot remove the last owner/);
    });

    it('should allow removing owner when multiple owners exist', async () => {
      const membershipData = {
        company_id: 'company-123',
        role: 'owner',
      };

      const ownersData = [
        { id: 'member-123' },
        { id: 'member-456' },
      ]; // Multiple owners

      // First call to fetch membership
      maybeSingleMock.mockResolvedValueOnce({ data: membershipData, error: null });

      // Second call to check owners count
      eqMock.mockImplementationOnce(() => ({
        eq: vi.fn(() => Promise.resolve({ data: ownersData, error: null })),
      }));

      // Third call to delete
      eqMock.mockResolvedValueOnce({ error: null });

      await MembershipQueries.removeMember('member-123');

      expect(deleteMock).toHaveBeenCalled();
    });

    it('should throw error when membership not found', async () => {
      maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(MembershipQueries.removeMember('nonexistent-member')).rejects.toThrow();
    });
  });

  describe('leaveCompany', () => {
    it('should allow non-owner member to leave company', async () => {
      const mockUser = { id: 'user-123' };
      const membershipData = {
        id: 'membership-123',
        role: 'member',
      };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // First call to find membership
      maybeSingleMock.mockResolvedValueOnce({ data: membershipData, error: null });

      // Second call to delete
      eqMock.mockResolvedValueOnce({ error: null });

      await MembershipQueries.leaveCompany('company-123');

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(deleteMock).toHaveBeenCalled();
    });

    it('should throw error when user not authenticated', async () => {
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      await expect(MembershipQueries.leaveCompany('company-123')).rejects.toThrow();
    });

    it('should throw error when user not a member of company', async () => {
      const mockUser = { id: 'user-123' };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(MembershipQueries.leaveCompany('company-123')).rejects.toThrow(/not a member/);
    });

    it('should throw error when last owner attempts to leave', async () => {
      const mockUser = { id: 'owner-user-id' };
      const membershipData = {
        id: 'membership-123',
        role: 'owner',
      };

      const ownersData = [{ id: 'membership-123' }]; // Only one owner

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // First call to find membership
      maybeSingleMock.mockResolvedValueOnce({ data: membershipData, error: null });

      // Second call to check owners count
      eqMock.mockImplementationOnce(() => ({
        eq: vi.fn(() => Promise.resolve({ data: ownersData, error: null })),
      }));

      await expect(MembershipQueries.leaveCompany('company-123')).rejects.toThrow(/Cannot leave company as the last owner/);
    });

    it('should allow owner to leave when multiple owners exist', async () => {
      const mockUser = { id: 'owner-user-id' };
      const membershipData = {
        id: 'membership-123',
        role: 'owner',
      };

      const ownersData = [
        { id: 'membership-123' },
        { id: 'membership-456' },
      ];

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // First call to find membership
      maybeSingleMock.mockResolvedValueOnce({ data: membershipData, error: null });

      // Second call to check owners count
      eqMock.mockImplementationOnce(() => ({
        eq: vi.fn(() => Promise.resolve({ data: ownersData, error: null })),
      }));

      // Third call to delete
      eqMock.mockResolvedValueOnce({ error: null });

      await MembershipQueries.leaveCompany('company-123');

      expect(deleteMock).toHaveBeenCalled();
    });

    it('should allow admin to leave company', async () => {
      const mockUser = { id: 'admin-user-id' };
      const membershipData = {
        id: 'membership-123',
        role: 'admin',
      };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      maybeSingleMock.mockResolvedValueOnce({ data: membershipData, error: null });
      eqMock.mockResolvedValueOnce({ error: null });

      await MembershipQueries.leaveCompany('company-123');

      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
