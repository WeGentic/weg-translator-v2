/**
 * @file AccountManagementExample.tsx
 * @description Example component demonstrating role-based UI permissions
 * for account management features.
 *
 * TASK 8.3: Conditionally render UI elements based on permission flags
 * This component serves as a reference implementation for permission-based UI.
 *
 * @see usePermissions hook for permission calculation
 * @see Task 8.3: Update account management UI to conditionally render by permissions
 */

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { usePermissions } from "@/modules/auth/hooks/usePermissions";
import { useAuth } from "@/app/providers/auth/AuthProvider";
import { RoleBadge } from "@/modules/auth/components/RoleBadge";
import { Trash2, UserPlus, Settings, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";

/**
 * Example account management component showing permission-based UI.
 * Demonstrates:
 * - Hiding features user doesn't have permission to access
 * - Disabling controls based on role
 * - Showing role badge for current user
 */
export function AccountManagementExample() {
  const {
    canManageAccount,
    canInviteUsers,
    canDeleteAccount,
    canEditSettings,
  } = usePermissions();
  const { userRole, user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Account Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </div>
            {/* TASK 8.3: Display role badge showing current role */}
            <RoleBadge role={userRole} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Account Name</h4>
            <p className="text-sm text-muted-foreground">
              {user?.name || "No name set"}
            </p>
          </div>

          <Separator />

          {/* TASK 8.3: Conditionally render Edit Settings button based on permissions */}
          {canEditSettings ? (
            <Button className="w-full" variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Edit Account Settings
            </Button>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You don't have permission to edit account settings
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Management Card */}
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>
            Invite and manage team members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TASK 8.3: Hide invite button when canInviteUsers=false */}
          {canInviteUsers ? (
            <Button className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Team Member
            </Button>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Only owners and admins can invite users
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Current Members</h4>
            <p className="text-sm text-muted-foreground">
              {canManageAccount
                ? "You can view and manage all team members"
                : "You can only view team members"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* TASK 8.3: Hide delete button when canDeleteAccount=false */}
          {canDeleteAccount ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all associated data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive">
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Only the account owner can delete the account
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission Summary (Development helper) */}
      <Card className="bg-muted">
        <CardHeader>
          <CardTitle className="text-sm">Permission Summary</CardTitle>
          <CardDescription className="text-xs">
            Current user permissions (for development)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs font-mono">
          <div>canManageAccount: {canManageAccount.toString()}</div>
          <div>canInviteUsers: {canInviteUsers.toString()}</div>
          <div>canDeleteAccount: {canDeleteAccount.toString()}</div>
          <div>canEditSettings: {canEditSettings.toString()}</div>
          <div className="pt-2 border-t">Role: {userRole || "none"}</div>
        </CardContent>
      </Card>
    </div>
  );
}
