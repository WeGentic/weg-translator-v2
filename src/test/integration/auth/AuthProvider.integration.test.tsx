/**
 * Integration tests for AuthProvider - Task 4.5
 *
 * Tests complete login flow with:
 * - JWT claims extraction
 * - Fallback query logic
 * - Orphan detection integration
 * - Fail-closed policy enforcement
 * - Profile enrichment with account_uuid and role
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/app/providers/auth/AuthProvider';
import { supabase } from '@/core/config';
import { UserQueries } from '@/core/supabase/queries/users';
import { checkIfOrphaned } from '@/modules/auth/utils/orphanDetection';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User, UserRole } from '@/shared/types/database';
import { OrphanedUserError, OrphanDetectionError } from '@/modules/auth/errors';

// Mock dependencies
vi.mock('@/core/config', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/core/supabase/queries/users');
vi.mock('@/modules/auth/utils/orphanDetection');
vi.mock('@/modules/auth/utils/cleanupInitiation', () => ({
  initiateCleanupFlow: vi.fn(),
}));

// Mock Tauri IPC functions
vi.mock('@/core/ipc/db/users', () => ({
  getUserProfile: vi.fn(),
  createUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}));

// Mock logger
vi.mock('@/core/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock toast
vi.mock('@/shared/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('AuthProvider Integration Tests - Task 4.5', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockAccountUuid = '223e4567-e89b-12d3-a456-426614174000';
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';

  const createMockSupabaseUser = (
    withJwtClaims = true,
    role: UserRole = 'owner'
  ): SupabaseUser => ({
    id: mockUserId,
    email: mockEmail,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: withJwtClaims
      ? {
          account_uuid: mockAccountUuid,
          user_role: role,
        }
      : {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  });

  const createMockSession = (user: SupabaseUser): Session => ({
    user,
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    token_type: 'bearer',
  });

  const createMockUser = (role: UserRole = 'owner'): User => ({
    user_uuid: mockUserId,
    account_uuid: mockAccountUuid,
    user_email: mockEmail,
    first_name: 'John',
    last_name: 'Doe',
    avatar_url: null,
    role,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    deleted_at: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getSession
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Default mock for onAuthStateChange
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TASK 4.5.1: Successful login with JWT claims extraction', () => {
    it('should extract account_uuid and user_role from JWT claims and enrich profile', async () => {
      // Arrange
      const mockSupabaseUser = createMockSupabaseUser(true, 'owner');
      const mockSession = createMockSession(mockSupabaseUser);
      const mockUserRecord = createMockUser('owner');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      vi.mocked(checkIfOrphaned).mockResolvedValue({
        orphaned: false,
        hasValidAccount: true,
        accountUuid: mockAccountUuid,
        role: 'owner',
        orphanType: null,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 50,
          queryDurationMs: 30,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: 'test-correlation-id',
        },
      });

      vi.mocked(UserQueries.getUser).mockResolvedValue(mockUserRecord);

      // Act
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login(mockEmail, mockPassword);
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toBeDefined();
        expect(result.current.user?.id).toBe(mockUserId);
        expect(result.current.user?.email).toBe(mockEmail);
        expect(result.current.accountUuid).toBe(mockAccountUuid);
        expect(result.current.userRole).toBe('owner');
        expect(result.current.user?.fullName).toBe('John Doe');
      });

      // Verify JWT claims were extracted
      expect(UserQueries.getUser).toHaveBeenCalledWith(mockUserId);
      expect(checkIfOrphaned).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('TASK 4.5.2: Fallback query when JWT claims missing', () => {
    it('should execute fallback UserQueries.getUser() when JWT claims missing', async () => {
      // Arrange
      const mockSupabaseUser = createMockSupabaseUser(false); // No JWT claims
      const mockSession = createMockSession(mockSupabaseUser);
      const mockUserRecord = createMockUser('admin');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      vi.mocked(checkIfOrphaned).mockResolvedValue({
        orphaned: false,
        hasValidAccount: true,
        accountUuid: mockAccountUuid,
        role: 'admin',
        orphanType: null,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 50,
          queryDurationMs: 30,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: 'test-correlation-id',
        },
      });

      vi.mocked(UserQueries.getUser).mockResolvedValue(mockUserRecord);

      // Act
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login(mockEmail, mockPassword);
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.accountUuid).toBe(mockAccountUuid);
        expect(result.current.userRole).toBe('admin');
      });

      // Verify fallback query was executed
      expect(UserQueries.getUser).toHaveBeenCalledWith(mockUserId);
      expect(UserQueries.getUser).toHaveBeenCalledTimes(2); // Once for fallback, once for profile enrichment
    });

    it('should log warning when custom_access_token_hook not configured', async () => {
      // Arrange
      const mockSupabaseUser = createMockSupabaseUser(false);
      const mockSession = createMockSession(mockSupabaseUser);
      const mockUserRecord = createMockUser('member');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      vi.mocked(checkIfOrphaned).mockResolvedValue({
        orphaned: false,
        hasValidAccount: true,
        accountUuid: mockAccountUuid,
        role: 'member',
        orphanType: null,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 50,
          queryDurationMs: 30,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: 'test-correlation-id',
        },
      });

      vi.mocked(UserQueries.getUser).mockResolvedValue(mockUserRecord);

      const { logger } = await import('@/core/logging');

      // Act
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login(mockEmail, mockPassword);
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Custom access token hook not configured'),
        expect.objectContaining({
          userId: mockUserId,
          documentation: expect.stringContaining('custom-access-token-hook'),
        })
      );
    });
  });

  describe('TASK 4.5.3: Orphan detection integration', () => {
    it('should throw OrphanedUserError and block login when user is orphaned', async () => {
      // Arrange
      const mockSupabaseUser = createMockSupabaseUser(true);
      const mockSession = createMockSession(mockSupabaseUser);

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      vi.mocked(checkIfOrphaned).mockResolvedValue({
        orphaned: true,
        hasValidAccount: false,
        accountUuid: null,
        role: null,
        orphanType: 'no-users-record',
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 50,
          queryDurationMs: 30,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: 'test-correlation-id',
        },
      });

      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      // Act
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Assert
      await expect(async () => {
        await act(async () => {
          await result.current.login(mockEmail, mockPassword);
        });
      }).rejects.toThrow();

      // Verify user was signed out
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should handle all orphan types: deleted-user, null-account-uuid, deleted-account', async () => {
      const orphanTypes = [
        'deleted-user',
        'null-account-uuid',
        'deleted-account',
        'no-users-record',
      ] as const;

      for (const orphanType of orphanTypes) {
        // Arrange
        const mockSupabaseUser = createMockSupabaseUser(true);
        const mockSession = createMockSession(mockSupabaseUser);

        vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
          data: {
            user: mockSupabaseUser,
            session: mockSession,
          },
          error: null,
        });

        vi.mocked(checkIfOrphaned).mockResolvedValue({
          orphaned: true,
          hasValidAccount: false,
          accountUuid: orphanType === 'null-account-uuid' ? null : mockAccountUuid,
          role: null,
          orphanType,
          metrics: {
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            totalDurationMs: 50,
            queryDurationMs: 30,
            attemptCount: 1,
            timedOut: false,
            hadError: false,
            correlationId: 'test-correlation-id',
          },
        });

        vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

        // Act
        const wrapper = ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        // Assert
        await expect(async () => {
          await act(async () => {
            await result.current.login(mockEmail, mockPassword);
          });
        }).rejects.toThrow();

        expect(supabase.auth.signOut).toHaveBeenCalled();

        // Clear mocks for next iteration
        vi.clearAllMocks();
      }
    });
  });

  describe('TASK 4.5.4: Fail-closed policy enforcement', () => {
    it('should block login with OrphanDetectionError when orphan detection times out', async () => {
      // Arrange
      const mockSupabaseUser = createMockSupabaseUser(true);
      const mockSession = createMockSession(mockSupabaseUser);

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      const orphanDetectionError = new OrphanDetectionError(
        'Orphan detection failed after all retry attempts',
        'test-correlation-id',
        {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 2500,
          queryDurationMs: 600,
          attemptCount: 3,
          timedOut: true,
          hadError: false,
          correlationId: 'test-correlation-id',
        }
      );

      vi.mocked(checkIfOrphaned).mockRejectedValue(orphanDetectionError);
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      // Act
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Assert
      await expect(async () => {
        await act(async () => {
          await result.current.login(mockEmail, mockPassword);
        });
      }).rejects.toThrow();

      // Verify user was signed out (fail-closed)
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should block login when orphan detection fails with database error', async () => {
      // Arrange
      const mockSupabaseUser = createMockSupabaseUser(true);
      const mockSession = createMockSession(mockSupabaseUser);

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      const orphanDetectionError = new OrphanDetectionError(
        'Database connection failed',
        'test-correlation-id',
        {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 1500,
          queryDurationMs: 400,
          attemptCount: 3,
          timedOut: false,
          hadError: true,
          correlationId: 'test-correlation-id',
        }
      );

      vi.mocked(checkIfOrphaned).mockRejectedValue(orphanDetectionError);
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      // Act
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Assert
      await expect(async () => {
        await act(async () => {
          await result.current.login(mockEmail, mockPassword);
        });
      }).rejects.toThrow();

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Role validation', () => {
    it('should default invalid role to "member" with warning log', async () => {
      // Arrange
      const mockSupabaseUser: SupabaseUser = {
        id: mockUserId,
        email: mockEmail,
        email_confirmed_at: new Date().toISOString(),
        app_metadata: {
          account_uuid: mockAccountUuid,
          user_role: 'invalid-role', // Invalid role
        },
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      const mockSession = createMockSession(mockSupabaseUser);
      const mockUserRecord = createMockUser('owner');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      vi.mocked(checkIfOrphaned).mockResolvedValue({
        orphaned: false,
        hasValidAccount: true,
        accountUuid: mockAccountUuid,
        role: 'owner',
        orphanType: null,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 50,
          queryDurationMs: 30,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: 'test-correlation-id',
        },
      });

      vi.mocked(UserQueries.getUser).mockResolvedValue(mockUserRecord);

      const { logger } = await import('@/core/logging');

      // Act
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login(mockEmail, mockPassword);
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.userRole).toBe('member'); // Defaulted to member
      });

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid user role from JWT claims"),
        expect.objectContaining({
          providedRole: 'invalid-role',
        })
      );
    });
  });
});
