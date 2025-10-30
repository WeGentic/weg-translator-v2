/**
 * @file usePermissions.test.tsx
 * @description Tests for usePermissions hook validating permission calculations for each role
 *
 * TASK 8.5.1: Test permission calculations - verify each role returns correct permission flags
 * @see subtask 8.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "../usePermissions";
import type { UserRole } from "@/shared/types/database";

// Mock the AuthProvider
vi.mock("@/app/providers/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

// Mock logger to prevent console noise during tests
vi.mock("@/core/logging", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mock to get mocked version
import { useAuth } from "@/app/providers/auth/AuthProvider";

describe("usePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TASK 8.5.1: Permission calculations for each role", () => {
    it("should return all permissions TRUE for owner role", () => {
      // Arrange: Mock AuthProvider with owner role
      vi.mocked(useAuth).mockReturnValue({
        userRole: "owner" as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Act: Render hook
      const { result } = renderHook(() => usePermissions());

      // Assert: Owner gets all permissions
      expect(result.current).toEqual({
        canManageAccount: true,
        canInviteUsers: true,
        canDeleteAccount: true,
        canEditSettings: true,
      });
    });

    it("should return admin permissions (all except canDeleteAccount) for admin role", () => {
      // Arrange: Mock AuthProvider with admin role
      vi.mocked(useAuth).mockReturnValue({
        userRole: "admin" as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Act: Render hook
      const { result } = renderHook(() => usePermissions());

      // Assert: Admin gets most permissions except canDeleteAccount
      expect(result.current).toEqual({
        canManageAccount: true,
        canInviteUsers: true,
        canDeleteAccount: false, // ❌ Admin cannot delete account
        canEditSettings: true,
      });
    });

    it("should return all permissions FALSE for member role", () => {
      // Arrange: Mock AuthProvider with member role
      vi.mocked(useAuth).mockReturnValue({
        userRole: "member" as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Act: Render hook
      const { result } = renderHook(() => usePermissions());

      // Assert: Member gets no management permissions
      expect(result.current).toEqual({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });
    });

    it("should return all permissions FALSE for viewer role", () => {
      // Arrange: Mock AuthProvider with viewer role
      vi.mocked(useAuth).mockReturnValue({
        userRole: "viewer" as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Act: Render hook
      const { result } = renderHook(() => usePermissions());

      // Assert: Viewer gets no management permissions (read-only)
      expect(result.current).toEqual({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });
    });

    it("should return all permissions FALSE for null role (fail-closed)", () => {
      // Arrange: Mock AuthProvider with no role
      vi.mocked(useAuth).mockReturnValue({
        userRole: null,
        user: null,
        isAuthenticated: false,
        isVerified: false,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: null,
        hasActiveSubscription: false,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Act: Render hook
      const { result } = renderHook(() => usePermissions());

      // Assert: No role = no permissions (fail-closed)
      expect(result.current).toEqual({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });
    });

    it("should log warning and return no permissions for unknown role", () => {
      // Arrange: Mock AuthProvider with invalid role
      vi.mocked(useAuth).mockReturnValue({
        userRole: "invalid-role" as unknown as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Import logger to check calls
      const { logger } = await import("@/core/logging");

      // Act: Render hook
      const { result } = renderHook(() => usePermissions());

      // Assert: Unknown role = no permissions + warning logged
      expect(result.current).toEqual({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        "Unknown user role, defaulting to no permissions",
        expect.objectContaining({
          role: "invalid-role",
          correlationId: expect.any(String),
        })
      );
    });
  });

  describe("Memoization", () => {
    it("should memoize permission calculation when role doesn't change", () => {
      // Arrange: Mock AuthProvider with owner role
      vi.mocked(useAuth).mockReturnValue({
        userRole: "owner" as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Act: Render hook twice
      const { result, rerender } = renderHook(() => usePermissions());
      const firstResult = result.current;

      rerender();
      const secondResult = result.current;

      // Assert: Same reference (memoized)
      expect(firstResult).toBe(secondResult);
    });

    it("should recalculate permissions when role changes", () => {
      // Arrange: Start with owner role
      const mockAuth = {
        userRole: "owner" as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      };
      vi.mocked(useAuth).mockReturnValue(mockAuth);

      // Act: Render hook with owner role
      const { result, rerender } = renderHook(() => usePermissions());
      const ownerPermissions = result.current;

      // Change role to member
      mockAuth.userRole = "member";
      rerender();
      const memberPermissions = result.current;

      // Assert: Different permissions after role change
      expect(ownerPermissions).not.toEqual(memberPermissions);
      expect(ownerPermissions.canDeleteAccount).toBe(true);
      expect(memberPermissions.canDeleteAccount).toBe(false);
    });
  });

  describe("Integration with AuthProvider", () => {
    it("should extract userRole from AuthProvider context", () => {
      // Arrange: Mock AuthProvider
      const mockUseAuth = vi.mocked(useAuth);
      mockUseAuth.mockReturnValue({
        userRole: "admin" as UserRole,
        user: null,
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account-uuid",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      // Act: Render hook
      renderHook(() => usePermissions());

      // Assert: useAuth was called to get userRole
      expect(mockUseAuth).toHaveBeenCalled();
    });
  });

  describe("Role hierarchy verification", () => {
    it("should enforce owner > admin > member > viewer hierarchy", () => {
      const roles: UserRole[] = ["owner", "admin", "member", "viewer"];
      const permissionCounts: number[] = [];

      // Calculate permission count for each role
      for (const role of roles) {
        vi.mocked(useAuth).mockReturnValue({
          userRole: role,
          user: null,
          isAuthenticated: true,
          isVerified: true,
          login: vi.fn(),
          logout: vi.fn(),
          isLoading: false,
          session: null,
          accountUuid: "test-account-uuid",
          hasActiveSubscription: true,
          trialEndsAt: null,
          daysRemaining: null,
        });

        const { result } = renderHook(() => usePermissions());
        const permissions = result.current;

        // Count true permissions
        const count = Object.values(permissions).filter(Boolean).length;
        permissionCounts.push(count);
      }

      // Assert: Permission count decreases as role privilege decreases
      // owner (4) >= admin (3) >= member (0) >= viewer (0)
      expect(permissionCounts[0]).toBeGreaterThanOrEqual(permissionCounts[1]); // owner >= admin
      expect(permissionCounts[1]).toBeGreaterThanOrEqual(permissionCounts[2]); // admin >= member
      expect(permissionCounts[2]).toBeGreaterThanOrEqual(permissionCounts[3]); // member >= viewer
      expect(permissionCounts[0]).toBe(4); // owner has all 4
      expect(permissionCounts[1]).toBe(3); // admin has 3
      expect(permissionCounts[2]).toBe(0); // member has 0
      expect(permissionCounts[3]).toBe(0); // viewer has 0
    });
  });
});
