/**
 * Type verification tests for Supabase schema types.
 * These tests verify that types are correctly defined and compatible.
 */

import { describe, it, expect } from 'vitest';
import type {
  Address,
  MemberRole,
  Company,
  CompanyCreatePayload,
  CompanyUpdatePayload,
  Profile,
  ProfileUpdatePayload,
  CompanyMember,
  InviteMemberPayload,
  UpdateMemberRolePayload,
  RemoveMemberPayload,
} from '../database';

describe('Supabase Schema Types', () => {
  describe('Address interface', () => {
    it('should allow all fields to be optional', () => {
      const emptyAddress: Address = {};
      const partialAddress: Address = {
        city: 'San Francisco',
        country: 'US',
      };
      const fullAddress: Address = {
        street: '123 Main St',
        city: 'San Francisco',
        postal_code: '94102',
        country: 'US',
        state: 'CA',
        line1: 'Suite 100',
        line2: 'Building A',
      };

      expect(emptyAddress).toBeDefined();
      expect(partialAddress).toBeDefined();
      expect(fullAddress).toBeDefined();
    });
  });

  describe('MemberRole type', () => {
    it('should only allow valid role values', () => {
      const owner: MemberRole = 'owner';
      const admin: MemberRole = 'admin';
      const member: MemberRole = 'member';

      expect(['owner', 'admin', 'member']).toContain(owner);
      expect(['owner', 'admin', 'member']).toContain(admin);
      expect(['owner', 'admin', 'member']).toContain(member);
    });
  });

  describe('Company type', () => {
    it('should have all required fields', () => {
      const company: Company = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        vat_id: 'US123456789',
        email: 'test@example.com',
        phone: null,
        address: null,
        logo_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(company.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(company.name).toBe('Test Company');
    });

    it('should support optional fields with values', () => {
      const company: Company = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        vat_id: 'US123456789',
        email: 'test@example.com',
        phone: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'City',
          postal_code: '12345',
          country: 'US',
        },
        logo_url: 'logos/test.png',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(company.phone).toBe('+1234567890');
      expect(company.address).toBeDefined();
      expect(company.logo_url).toBe('logos/test.png');
    });
  });

  describe('CompanyCreatePayload', () => {
    it('should require only essential fields', () => {
      const payload: CompanyCreatePayload = {
        name: 'Test Company',
        vat_id: 'US123456789',
        email: 'test@example.com',
      };

      expect(payload.name).toBe('Test Company');
      expect(payload.vat_id).toBe('US123456789');
    });

    it('should allow optional fields', () => {
      const payload: CompanyCreatePayload = {
        name: 'Test Company',
        vat_id: 'US123456789',
        email: 'test@example.com',
        phone: '+1234567890',
        address: {
          city: 'San Francisco',
          country: 'US',
        },
      };

      expect(payload.phone).toBe('+1234567890');
      expect(payload.address).toBeDefined();
    });
  });

  describe('CompanyUpdatePayload', () => {
    it('should require only id field', () => {
      const payload: CompanyUpdatePayload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      expect(payload.id).toBeDefined();
    });

    it('should allow partial updates', () => {
      const payload: CompanyUpdatePayload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Updated Name',
        email: 'newemail@example.com',
      };

      expect(payload.name).toBe('Updated Name');
      expect(payload.email).toBe('newemail@example.com');
    });

    it('should allow setting fields to null', () => {
      const payload: CompanyUpdatePayload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: null,
        address: null,
      };

      expect(payload.phone).toBeNull();
      expect(payload.address).toBeNull();
    });
  });

  describe('Profile type', () => {
    it('should have all fields with nullable metadata', () => {
      const profile: Profile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        full_name: 'John Doe',
        avatar_url: 'avatars/john.png',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(profile.full_name).toBe('John Doe');
      expect(profile.avatar_url).toBe('avatars/john.png');
    });

    it('should allow null metadata fields', () => {
      const profile: Profile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        full_name: null,
        avatar_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(profile.full_name).toBeNull();
      expect(profile.avatar_url).toBeNull();
    });
  });

  describe('ProfileUpdatePayload', () => {
    it('should require only id field', () => {
      const payload: ProfileUpdatePayload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      expect(payload.id).toBeDefined();
    });

    it('should allow partial updates', () => {
      const payload: ProfileUpdatePayload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        full_name: 'Jane Doe',
      };

      expect(payload.full_name).toBe('Jane Doe');
    });

    it('should allow setting fields to null', () => {
      const payload: ProfileUpdatePayload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        avatar_url: null,
      };

      expect(payload.avatar_url).toBeNull();
    });
  });

  describe('CompanyMember type', () => {
    it('should have all required fields', () => {
      const member: CompanyMember = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        company_id: '123e4567-e89b-12d3-a456-426614174001',
        user_id: '123e4567-e89b-12d3-a456-426614174002',
        role: 'admin',
        invited_by: '123e4567-e89b-12d3-a456-426614174003',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(member.role).toBe('admin');
      expect(member.invited_by).toBeDefined();
    });

    it('should allow null invited_by for self-registration', () => {
      const member: CompanyMember = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        company_id: '123e4567-e89b-12d3-a456-426614174001',
        user_id: '123e4567-e89b-12d3-a456-426614174002',
        role: 'owner',
        invited_by: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(member.invited_by).toBeNull();
    });
  });

  describe('InviteMemberPayload', () => {
    it('should have all required fields', () => {
      const payload: InviteMemberPayload = {
        company_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        role: 'member',
      };

      expect(payload.role).toBe('member');
    });
  });

  describe('UpdateMemberRolePayload', () => {
    it('should have all required fields', () => {
      const payload: UpdateMemberRolePayload = {
        member_id: '123e4567-e89b-12d3-a456-426614174000',
        new_role: 'admin',
      };

      expect(payload.new_role).toBe('admin');
    });
  });

  describe('RemoveMemberPayload', () => {
    it('should have all required fields', () => {
      const payload: RemoveMemberPayload = {
        member_id: '123e4567-e89b-12d3-a456-426614174000',
        company_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(payload.member_id).toBeDefined();
      expect(payload.company_id).toBeDefined();
    });
  });

  describe('Type compatibility', () => {
    it('should allow Company to satisfy CompanyCreatePayload structure', () => {
      const company: Company = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        vat_id: 'US123456789',
        email: 'test@example.com',
        phone: '+1234567890',
        address: { city: 'SF', country: 'US' },
        logo_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      // Extract fields that match CompanyCreatePayload
      const createPayload: CompanyCreatePayload = {
        name: company.name,
        vat_id: company.vat_id,
        email: company.email,
        phone: company.phone ?? undefined,
        address: company.address ?? undefined,
      };

      expect(createPayload.name).toBe(company.name);
      expect(createPayload.email).toBe(company.email);
    });
  });
});
