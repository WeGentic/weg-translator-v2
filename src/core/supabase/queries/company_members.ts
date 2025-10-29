/**
 * Type-safe query helpers for company membership CRUD operations.
 * Uses Supabase client for direct cloud database access with RLS enforcement.
 */

import { supabase } from '@/core/config/supabaseClient';
import type {
  CompanyMember,
  InviteMemberPayload,
  UpdateMemberRolePayload,
} from '@/shared/types/database';
import {
  generateCorrelationId,
  logOperationError,
  mapSupabaseError,
  type UserFriendlyError,
} from '../errors';

/**
 * Static methods for company membership database operations.
 * All methods use authenticated Supabase client with RLS policy enforcement.
 */
export class MembershipQueries {
  /**
   * List all members of a company.
   * RLS: User must be a member of the company to view memberships.
   *
   * @param companyId - UUID of the company
   * @returns Array of company members
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const members = await MembershipQueries.listCompanyMembers('123e4567-e89b-12d3-a456-426614174000');
   * console.log(`Company has ${members.length} members`);
   * ```
   */
  static async listCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('company_members')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('listCompanyMembers', userError, { companyId });
        throw userError;
      }

      return data || [];
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('listCompanyMembers', userError, { companyId });
      throw userError;
    }
  }

  /**
   * Invite a new member to a company.
   * RLS: User must be owner or admin to invite members.
   * Sets invited_by to current user ID automatically.
   *
   * @param payload - Membership creation data
   * @returns Created company member record
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const member = await MembershipQueries.inviteMember({
   *   company_id: '123e4567-e89b-12d3-a456-426614174000',
   *   user_id: '456e7890-e89b-12d3-a456-426614174111',
   *   role: 'member',
   * });
   * ```
   */
  static async inviteMember(
    payload: InviteMemberPayload
  ): Promise<CompanyMember> {
    const correlationId = generateCorrelationId();

    try {
      // Get current user for invited_by field
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        const userError = mapSupabaseError(
          authError || new Error('Not authenticated'),
          correlationId
        );
        logOperationError('inviteMember', userError, {
          reason: 'User not authenticated',
        });
        throw userError;
      }

      // Insert membership with invited_by set to current user
      const { data, error } = await supabase
        .from('company_members')
        .insert({
          ...payload,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('inviteMember', userError, {
          companyId: payload.company_id,
          newUserId: payload.user_id,
          inviterId: user.id,
        });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('inviteMember', userError);
      throw userError;
    }
  }

  /**
   * Update a member's role within a company.
   * RLS: Only owners can change member roles.
   *
   * @param payload - Role update data with member ID
   * @returns Updated company member record or null if not found/unauthorized
   * @throws UserFriendlyError if operation fails
   *
   * @example
   * ```typescript
   * const updated = await MembershipQueries.updateMemberRole({
   *   member_id: '789e0123-e89b-12d3-a456-426614174222',
   *   new_role: 'admin',
   * });
   * ```
   */
  static async updateMemberRole(
    payload: UpdateMemberRolePayload
  ): Promise<CompanyMember | null> {
    const correlationId = generateCorrelationId();

    try {
      const { data, error } = await supabase
        .from('company_members')
        .update({ role: payload.new_role })
        .eq('id', payload.member_id)
        .select()
        .maybeSingle();

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('updateMemberRole', userError, {
          memberId: payload.member_id,
          newRole: payload.new_role,
        });
        throw userError;
      }

      return data;
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('updateMemberRole', userError);
      throw userError;
    }
  }

  /**
   * Remove a member from a company.
   * RLS: Owners and admins can remove others, users can remove themselves.
   * Validates that the last owner cannot be removed.
   *
   * @param memberId - UUID of the membership record to remove
   * @throws UserFriendlyError if operation fails or attempting to remove last owner
   *
   * @example
   * ```typescript
   * await MembershipQueries.removeMember('789e0123-e89b-12d3-a456-426614174222');
   * console.log('Member removed successfully');
   * ```
   */
  static async removeMember(memberId: string): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      // First, fetch the membership to check if it's an owner
      const { data: membership, error: fetchError } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('id', memberId)
        .maybeSingle();

      if (fetchError) {
        const userError = mapSupabaseError(fetchError, correlationId);
        logOperationError('removeMember', userError, { memberId });
        throw userError;
      }

      if (!membership) {
        throw mapSupabaseError(new Error('Membership not found'), correlationId);
      }

      // If removing an owner, verify there are other owners
      if (membership.role === 'owner') {
        const { data: owners, error: ownerError } = await supabase
          .from('company_members')
          .select('id')
          .eq('company_id', membership.company_id)
          .eq('role', 'owner');

        if (ownerError) {
          const userError = mapSupabaseError(ownerError, correlationId);
          logOperationError('removeMember', userError, {
            memberId,
            reason: 'Failed to check owner count',
          });
          throw userError;
        }

        if (owners && owners.length <= 1) {
          const userError: UserFriendlyError = {
            type: 'validation',
            message:
              'Cannot remove the last owner. Promote another member to owner first.',
            correlationId,
          };
          logOperationError('removeMember', userError, {
            memberId,
            companyId: membership.company_id,
            reason: 'Last owner removal attempt',
          });
          throw userError;
        }
      }

      // Proceed with removal
      const { error } = await supabase
        .from('company_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('removeMember', userError, { memberId });
        throw userError;
      }
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('removeMember', userError, { memberId });
      throw userError;
    }
  }

  /**
   * Leave a company (remove current user's membership).
   * Convenience method for self-removal.
   * Validates that the last owner cannot leave.
   *
   * @param companyId - UUID of the company to leave
   * @throws UserFriendlyError if operation fails or user is last owner
   *
   * @example
   * ```typescript
   * await MembershipQueries.leaveCompany('123e4567-e89b-12d3-a456-426614174000');
   * console.log('Successfully left company');
   * ```
   */
  static async leaveCompany(companyId: string): Promise<void> {
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
        logOperationError('leaveCompany', userError, {
          reason: 'User not authenticated',
        });
        throw userError;
      }

      // Find user's membership
      const { data: membership, error: fetchError } = await supabase
        .from('company_members')
        .select('id, role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        const userError = mapSupabaseError(fetchError, correlationId);
        logOperationError('leaveCompany', userError, { companyId, userId: user.id });
        throw userError;
      }

      if (!membership) {
        const userError: UserFriendlyError = {
          type: 'not_found',
          message: 'You are not a member of this company',
          correlationId,
        };
        logOperationError('leaveCompany', userError, { companyId, userId: user.id });
        throw userError;
      }

      // If user is an owner, verify there are other owners
      if (membership.role === 'owner') {
        const { data: owners, error: ownerError } = await supabase
          .from('company_members')
          .select('id')
          .eq('company_id', companyId)
          .eq('role', 'owner');

        if (ownerError) {
          const userError = mapSupabaseError(ownerError, correlationId);
          logOperationError('leaveCompany', userError, {
            companyId,
            userId: user.id,
            reason: 'Failed to check owner count',
          });
          throw userError;
        }

        if (owners && owners.length <= 1) {
          const userError: UserFriendlyError = {
            type: 'validation',
            message:
              'Cannot leave company as the last owner. Promote another member to owner first or delete the company.',
            correlationId,
          };
          logOperationError('leaveCompany', userError, {
            companyId,
            userId: user.id,
            reason: 'Last owner leave attempt',
          });
          throw userError;
        }
      }

      // Remove membership
      const { error } = await supabase
        .from('company_members')
        .delete()
        .eq('id', membership.id);

      if (error) {
        const userError = mapSupabaseError(error, correlationId);
        logOperationError('leaveCompany', userError, {
          companyId,
          userId: user.id,
          membershipId: membership.id,
        });
        throw userError;
      }
    } catch (error) {
      if ((error as UserFriendlyError).correlationId) {
        throw error;
      }

      const userError = mapSupabaseError(error, correlationId);
      logOperationError('leaveCompany', userError, { companyId });
      throw userError;
    }
  }
}
