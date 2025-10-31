/**
 * @file PermissionBasedUI.test.tsx
 * @description Tests for permission-based UI components and role badge display
 *
 * TASK 8.5.2: Test UI rendering - verify owner sees all controls, admin sees most,
 * member sees minimal, viewer sees read-only
 * @see subtask 8.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge } from "../RoleBadge";
import { AccountManagementExample } from "../AccountManagementExample";
import type { UserRole } from "@/shared/types/database";

// Mock the hooks
vi.mock("@/modules/auth/hooks/usePermissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/app/providers/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

// Import after mocking
import { usePermissions } from "@/modules/auth/hooks/usePermissions";
import { useAuth } from "@/app/providers/auth/AuthProvider";

describe("RoleBadge Component", () => {
  it("should render owner badge with shield-check icon", () => {
    render(<RoleBadge role="owner" />);

    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByTitle("Full account control")).toBeInTheDocument();
  });

  it("should render admin badge with shield icon", () => {
    render(<RoleBadge role="admin" />);

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByTitle("Account management")).toBeInTheDocument();
  });

  it("should render member badge with user icon", () => {
    render(<RoleBadge role="member" />);

    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByTitle("Standard access")).toBeInTheDocument();
  });

  it("should render viewer badge with eye icon", () => {
    render(<RoleBadge role="viewer" />);

    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByTitle("Read-only access")).toBeInTheDocument();
  });

  it("should not render when role is null", () => {
    const { container } = render(<RoleBadge role={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should apply custom className when provided", () => {
    const { container } = render(<RoleBadge role="owner" className="custom-class" />);
    const badge = container.querySelector(".custom-class");
    expect(badge).toBeInTheDocument();
  });
});

describe("AccountManagementExample - TASK 8.5.2: UI Rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Owner role UI", () => {
    beforeEach(() => {
      // Mock owner permissions
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: true,
        canInviteUsers: true,
        canDeleteAccount: true,
        canEditSettings: true,
      });

      vi.mocked(useAuth).mockReturnValue({
        userRole: "owner" as UserRole,
        user: { id: "1", email: "owner@test.com", name: "Test Owner", emailVerified: true },
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });
    });

    it("should display all management controls for owner", () => {
      render(<AccountManagementExample />);

      // Check for all buttons
      expect(screen.getByText("Edit Account Settings")).toBeInTheDocument();
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument();
      expect(screen.getByText("Delete Account")).toBeInTheDocument();

      // Should NOT display permission denial messages
      expect(screen.queryByText(/don't have permission/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Only owners and admins/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Only the account owner/i)).not.toBeInTheDocument();
    });

    it("should display Owner role badge", () => {
      render(<AccountManagementExample />);
      expect(screen.getByText("Owner")).toBeInTheDocument();
    });

    it("should show all permissions true in summary", () => {
      render(<AccountManagementExample />);

      expect(screen.getByText(/canManageAccount: true/)).toBeInTheDocument();
      expect(screen.getByText(/canInviteUsers: true/)).toBeInTheDocument();
      expect(screen.getByText(/canDeleteAccount: true/)).toBeInTheDocument();
      expect(screen.getByText(/canEditSettings: true/)).toBeInTheDocument();
    });
  });

  describe("Admin role UI", () => {
    beforeEach(() => {
      // Mock admin permissions (all except canDeleteAccount)
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: true,
        canInviteUsers: true,
        canDeleteAccount: false, // ❌ Admin cannot delete
        canEditSettings: true,
      });

      vi.mocked(useAuth).mockReturnValue({
        userRole: "admin" as UserRole,
        user: { id: "2", email: "admin@test.com", name: "Test Admin", emailVerified: true },
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });
    });

    it("should display most controls except delete account for admin", () => {
      render(<AccountManagementExample />);

      // Admin can see these
      expect(screen.getByText("Edit Account Settings")).toBeInTheDocument();
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument();

      // Admin CANNOT see delete button, sees message instead
      expect(screen.queryByText("Delete Account")).not.toBeInTheDocument();
      expect(screen.getByText(/Only the account owner can delete/i)).toBeInTheDocument();
    });

    it("should display Admin role badge", () => {
      render(<AccountManagementExample />);
      expect(screen.getByText("Admin")).toBeInTheDocument();
    });

    it("should show canDeleteAccount: false in summary", () => {
      render(<AccountManagementExample />);
      expect(screen.getByText(/canDeleteAccount: false/)).toBeInTheDocument();
    });
  });

  describe("Member role UI", () => {
    beforeEach(() => {
      // Mock member permissions (all false)
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });

      vi.mocked(useAuth).mockReturnValue({
        userRole: "member" as UserRole,
        user: { id: "3", email: "member@test.com", name: "Test Member", emailVerified: true },
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });
    });

    it("should display minimal controls for member", () => {
      render(<AccountManagementExample />);

      // Member should NOT see action buttons
      expect(screen.queryByText("Edit Account Settings")).not.toBeInTheDocument();
      expect(screen.queryByText("Invite Team Member")).not.toBeInTheDocument();
      expect(screen.queryByText("Delete Account")).not.toBeInTheDocument();

      // Member SHOULD see permission denial messages
      expect(screen.getByText(/don't have permission to edit/i)).toBeInTheDocument();
      expect(screen.getByText(/Only owners and admins can invite/i)).toBeInTheDocument();
      expect(screen.getByText(/Only the account owner can delete/i)).toBeInTheDocument();
    });

    it("should display Member role badge", () => {
      render(<AccountManagementExample />);
      expect(screen.getByText("Member")).toBeInTheDocument();
    });

    it("should show read-only messaging", () => {
      render(<AccountManagementExample />);
      expect(screen.getByText(/You can only view team members/)).toBeInTheDocument();
    });

    it("should show all permissions false in summary", () => {
      render(<AccountManagementExample />);

      expect(screen.getByText(/canManageAccount: false/)).toBeInTheDocument();
      expect(screen.getByText(/canInviteUsers: false/)).toBeInTheDocument();
      expect(screen.getByText(/canDeleteAccount: false/)).toBeInTheDocument();
      expect(screen.getByText(/canEditSettings: false/)).toBeInTheDocument();
    });
  });

  describe("Viewer role UI", () => {
    beforeEach(() => {
      // Mock viewer permissions (all false)
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });

      vi.mocked(useAuth).mockReturnValue({
        userRole: "viewer" as UserRole,
        user: { id: "4", email: "viewer@test.com", name: "Test Viewer", emailVerified: true },
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });
    });

    it("should display read-only UI for viewer", () => {
      render(<AccountManagementExample />);

      // Viewer should NOT see any action buttons
      expect(screen.queryByText("Edit Account Settings")).not.toBeInTheDocument();
      expect(screen.queryByText("Invite Team Member")).not.toBeInTheDocument();
      expect(screen.queryByText("Delete Account")).not.toBeInTheDocument();

      // Viewer SHOULD see permission denial messages
      expect(screen.getByText(/don't have permission to edit/i)).toBeInTheDocument();
      expect(screen.getByText(/Only owners and admins can invite/i)).toBeInTheDocument();
      expect(screen.getByText(/Only the account owner can delete/i)).toBeInTheDocument();
    });

    it("should display Viewer role badge", () => {
      render(<AccountManagementExample />);
      expect(screen.getByText("Viewer")).toBeInTheDocument();
    });

    it("should show read-only messaging for viewer", () => {
      render(<AccountManagementExample />);
      expect(screen.getByText(/You can only view team members/)).toBeInTheDocument();
    });

    it("should show all permissions false in summary", () => {
      render(<AccountManagementExample />);

      expect(screen.getByText(/canManageAccount: false/)).toBeInTheDocument();
      expect(screen.getByText(/canInviteUsers: false/)).toBeInTheDocument();
      expect(screen.getByText(/canDeleteAccount: false/)).toBeInTheDocument();
      expect(screen.getByText(/canEditSettings: false/)).toBeInTheDocument();
    });
  });

  describe("Permission-based conditional rendering", () => {
    it("should conditionally render edit settings button", () => {
      // First render with canEditSettings: false
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });

      vi.mocked(useAuth).mockReturnValue({
        userRole: "member" as UserRole,
        user: { id: "1", email: "test@test.com", name: "Test", emailVerified: true },
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      const { rerender } = render(<AccountManagementExample />);
      expect(screen.queryByText("Edit Account Settings")).not.toBeInTheDocument();

      // Re-render with canEditSettings: true
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: true,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: true,
      });

      rerender(<AccountManagementExample />);
      expect(screen.getByText("Edit Account Settings")).toBeInTheDocument();
    });

    it("should conditionally render invite button", () => {
      // First render with canInviteUsers: false
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });

      vi.mocked(useAuth).mockReturnValue({
        userRole: "member" as UserRole,
        user: { id: "1", email: "test@test.com", name: "Test", emailVerified: true },
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      const { rerender } = render(<AccountManagementExample />);
      expect(screen.queryByText("Invite Team Member")).not.toBeInTheDocument();

      // Re-render with canInviteUsers: true
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: false,
        canInviteUsers: true,
        canDeleteAccount: false,
        canEditSettings: false,
      });

      rerender(<AccountManagementExample />);
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument();
    });

    it("should conditionally render delete account button", () => {
      // First render with canDeleteAccount: false
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: false,
        canEditSettings: false,
      });

      vi.mocked(useAuth).mockReturnValue({
        userRole: "admin" as UserRole,
        user: { id: "1", email: "test@test.com", name: "Test", emailVerified: true },
        isAuthenticated: true,
        isVerified: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
        accountUuid: "test-account",
        hasActiveSubscription: true,
        trialEndsAt: null,
        daysRemaining: null,
      });

      const { rerender } = render(<AccountManagementExample />);
      expect(screen.queryByText("Delete Account")).not.toBeInTheDocument();

      // Re-render with canDeleteAccount: true
      vi.mocked(usePermissions).mockReturnValue({
        canManageAccount: false,
        canInviteUsers: false,
        canDeleteAccount: true,
        canEditSettings: false,
      });

      rerender(<AccountManagementExample />);
      expect(screen.getByText("Delete Account")).toBeInTheDocument();
    });
  });
});
