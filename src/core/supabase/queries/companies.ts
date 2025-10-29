/**
 * Type-safe query helpers for company CRUD operations.
 * Uses Supabase client for direct cloud database access with RLS enforcement.
 */

import { supabase } from '@/core/config/supabaseClient';
import type {
  Company,
  CompanyCreatePayload,
  CompanyUpdatePayload,
} from '@/shared/types/database';
import {
  generateCorrelationId,
  logOperationError,
  mapSupabaseError,
  type UserFriendlyError,
} from '../errors';

/**
 * Static methods for company database operations.
 * All methods use authenticated Supabase client with RLS policy enforcement.
 */
export class CompanyQueries {
  /**
   * Fetch a single company by ID.
   * RLS: User must be a member of the company to view it.
   *
   * @param companyId - UUID of the company
   * @returns Company record or null if not found
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const company = await CompanyQueries.getCompany('123e4567-e89b-12d3-a456-426614174000');
   * if (company) {
   *   console.log('Company:', company.name);
   * }
   * ```
   */
  static async getCompany(companyId: string): Promise<Company | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('getCompany', userError, { companyId });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getCompany', userError, { companyId });
      throw userError;
    }
  }

  /**
   * List all companies for the current authenticated user.
   * Uses JOIN with company_members to filter by membership.
   * RLS: Automatically enforced through authenticated session.
   *
   * @returns Array of companies the user is a member of
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const companies = await CompanyQueries.listUserCompanies();
   * console.log(`User is member of ${companies.length} companies`);
   * ```
   */
  static async listUserCompanies(): Promise<Company[]> {
    const correlationId = generateCorrelationId();

    try {
      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        const userError = mapSupabaseError(
          authError || new Error('Not authenticated'),
          correlationId
        );
        logOperationError('listUserCompanies', userError, {
          reason: 'User not authenticated',
        });
        throw userError;
      }

      // Query companies with inner join on company_members
      // !inner ensures only companies with matching memberships are returned
      const { data, error } = await supabase
        .from('companies')
        .select(
          `
          *,
          company_members!inner(user_id)
        `
        )
        .eq('company_members.user_id', user.id);

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('listUserCompanies', userError, { userId: user.id });
        throw userError;
      }

      return data || [];
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('listUserCompanies', userError);
      throw userError;
    }
  }

  /**
   * Create a new company.
   * RLS: Any authenticated user can create a company.
   * Note: Caller must create corresponding company_members record with role='owner'.
   *
   * @param payload - Company creation data
   * @returns Created company record
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const company = await CompanyQueries.createCompany({
   *   name: 'Acme Inc.',
   *   vat_id: 'US123456789',
   *   email: 'contact@acme.com',
   *   phone: '+1234567890',
   *   address: {
   *     street: '123 Main St',
   *     city: 'San Francisco',
   *     postal_code: '94102',
   *     country: 'USA',
   *   },
   * });
   * ```
   */
  static async createCompany(payload: CompanyCreatePayload): Promise<Company> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert(payload)
        .select()
        .single();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('createCompany', userError, {
          payload: { ...payload, email: '[REDACTED]' },
        });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('createCompany', userError);
      throw userError;
    }
  }

  /**
   * Update an existing company.
   * RLS: User must be owner or admin to update company data.
   *
   * @param payload - Company update data with ID
   * @returns Updated company record or null if not found/unauthorized
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const updated = await CompanyQueries.updateCompany({
   *   id: '123e4567-e89b-12d3-a456-426614174000',
   *   name: 'Acme Corporation',
   *   phone: '+1234567891',
   * });
   * ```
   */
  static async updateCompany(
    payload: CompanyUpdatePayload
  ): Promise<Company | null> {
    const correlationId = generateCorrelationId();
    const { id, ...updates } = payload;

    try {
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('updateCompany', userError, { companyId: id });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('updateCompany', userError, { companyId: id });
      throw userError;
    }
  }

  /**
   * Delete a company.
   * RLS: Only company owners can delete companies.
   * Cascade: All company_members records will be deleted automatically.
   *
   * @param companyId - UUID of the company to delete
   * @throws UserFriendlyError if operation fails or user lacks permission
   *
   * @example
   * ```typescript
   * await CompanyQueries.deleteCompany('123e4567-e89b-12d3-a456-426614174000');
   * console.log('Company deleted successfully');
   * ```
   */
  static async deleteCompany(companyId: string): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('deleteCompany', userError, { companyId });
        throw userError;
      }
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('deleteCompany', userError, { companyId });
      throw userError;
    }
  }
}
