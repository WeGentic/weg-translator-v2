/**
 * Unit Tests for Company Queries
 *
 * Tests company CRUD operations with mocked Supabase client.
 * RLS policies are tested separately in integration tests.
 *
 * Requirements: Req #26 (Unit Testing)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { CompanyQueries } from '@/core/supabase/queries/companies';
import type { Company, CompanyCreatePayload, CompanyUpdatePayload } from '@/shared/types/database';

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

describe('CompanyQueries', () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let deleteMock: ReturnType<typeof vi.fn>;
  let singleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    maybeSingleMock = vi.fn();
    singleMock = vi.fn();
    eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock, select: selectMock }));
    selectMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock, single: singleMock }));
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

  describe('getCompany', () => {
    it('should fetch company by ID successfully', async () => {
      const mockCompany: Company = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        vat_id: 'VAT123',
        email: 'test@company.com',
        phone: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          postal_code: '94102',
          country: 'USA',
        },
        logo_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockCompany, error: null });

      const result = await CompanyQueries.getCompany('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockCompany);
      expect(fromMock).toHaveBeenCalledWith('companies');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return null when company not found', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await CompanyQueries.getCompany('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should throw error when database query fails', async () => {
      const dbError = { message: 'Database connection failed', code: '500' };
      maybeSingleMock.mockResolvedValue({ data: null, error: dbError });

      await expect(CompanyQueries.getCompany('123')).rejects.toThrow();
    });
  });

  describe('listUserCompanies', () => {
    it('should list companies for authenticated user', async () => {
      const mockUser = { id: 'user-123' };
      const mockCompanies: Company[] = [
        {
          id: 'company-1',
          name: 'Company 1',
          vat_id: 'VAT1',
          email: 'c1@test.com',
          phone: null,
          address: null,
          logo_url: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'company-2',
          name: 'Company 2',
          vat_id: 'VAT2',
          email: 'c2@test.com',
          phone: null,
          address: null,
          logo_url: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      eqMock.mockResolvedValue({ data: mockCompanies, error: null });

      const result = await CompanyQueries.listUserCompanies();

      expect(result).toEqual(mockCompanies);
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith('companies');
      expect(eqMock).toHaveBeenCalledWith('company_members.user_id', 'user-123');
    });

    it('should throw error when user not authenticated', async () => {
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      await expect(CompanyQueries.listUserCompanies()).rejects.toThrow();
    });

    it('should return empty array when user has no companies', async () => {
      const mockUser = { id: 'user-123' };

      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      eqMock.mockResolvedValue({ data: [], error: null });

      const result = await CompanyQueries.listUserCompanies();

      expect(result).toEqual([]);
    });
  });

  describe('createCompany', () => {
    it('should create company with valid data', async () => {
      const payload: CompanyCreatePayload = {
        name: 'New Company',
        vat_id: 'VAT_NEW',
        email: 'new@company.com',
        phone: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'SF',
          postal_code: '94102',
          country: 'USA',
        },
      };

      const mockCreatedCompany: Company = {
        id: 'new-company-id',
        ...payload,
        logo_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      singleMock.mockResolvedValue({ data: mockCreatedCompany, error: null });

      const result = await CompanyQueries.createCompany(payload);

      expect(result).toEqual(mockCreatedCompany);
      expect(fromMock).toHaveBeenCalledWith('companies');
      expect(insertMock).toHaveBeenCalledWith(payload);
      expect(selectMock).toHaveBeenCalled();
      expect(singleMock).toHaveBeenCalled();
    });

    it('should throw error for duplicate VAT ID', async () => {
      const payload: CompanyCreatePayload = {
        name: 'Duplicate Company',
        vat_id: 'VAT_DUPLICATE',
        email: 'dup@company.com',
      };

      const duplicateError = { message: 'duplicate key value violates unique constraint', code: '23505' };
      singleMock.mockResolvedValue({ data: null, error: duplicateError });

      await expect(CompanyQueries.createCompany(payload)).rejects.toThrow();
    });
  });

  describe('updateCompany', () => {
    it('should update company as owner', async () => {
      const payload: CompanyUpdatePayload = {
        id: 'company-123',
        name: 'Updated Company Name',
        phone: '+9876543210',
      };

      const mockUpdatedCompany: Company = {
        id: 'company-123',
        name: 'Updated Company Name',
        vat_id: 'VAT123',
        email: 'old@company.com',
        phone: '+9876543210',
        address: null,
        logo_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      maybeSingleMock.mockResolvedValue({ data: mockUpdatedCompany, error: null });

      const result = await CompanyQueries.updateCompany(payload);

      expect(result).toEqual(mockUpdatedCompany);
      expect(fromMock).toHaveBeenCalledWith('companies');
      expect(updateMock).toHaveBeenCalledWith({ name: 'Updated Company Name', phone: '+9876543210' });
      expect(eqMock).toHaveBeenCalledWith('id', 'company-123');
    });

    it('should return null when company not found or unauthorized', async () => {
      const payload: CompanyUpdatePayload = {
        id: 'nonexistent',
        name: 'Attempted Update',
      };

      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await CompanyQueries.updateCompany(payload);

      expect(result).toBeNull();
    });
  });

  describe('deleteCompany', () => {
    it('should delete company as owner', async () => {
      eqMock.mockResolvedValue({ error: null });

      await CompanyQueries.deleteCompany('company-123');

      expect(fromMock).toHaveBeenCalledWith('companies');
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('id', 'company-123');
    });

    it('should throw error when deletion fails', async () => {
      const deleteError = { message: 'Permission denied', code: '42501' };
      eqMock.mockResolvedValue({ error: deleteError });

      await expect(CompanyQueries.deleteCompany('company-123')).rejects.toThrow();
    });

    it('should not throw error when company not found (RLS filtered)', async () => {
      eqMock.mockResolvedValue({ error: null });

      await CompanyQueries.deleteCompany('nonexistent');

      // Should not throw - RLS filters out non-existent companies
      expect(true).toBe(true);
    });
  });
});
