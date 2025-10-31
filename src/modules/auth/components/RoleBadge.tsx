/**
 * @file RoleBadge.tsx
 * @description Badge component displaying user role from JWT claims with visual styling.
 * Shows the current role of the user in a color-coded badge for quick identification.
 *
 * @see Task 8.3: Add role badge to user profile display
 */

import type { UserRole } from "@/shared/types/database";
import { Badge } from "@/shared/ui/badge";
import { Shield, ShieldCheck, User, Eye } from "lucide-react";

interface RoleBadgeProps {
  /**
   * User role from JWT claims (via AuthProvider context)
   */
  role: UserRole | null;

  /**
   * Optional className for custom styling
   */
  className?: string;
}

/**
 * Visual configuration for each role including icon, label, and variant.
 */
const roleConfig: Record<
  UserRole,
  {
    icon: typeof Shield;
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    description: string;
  }
> = {
  owner: {
    icon: ShieldCheck,
    label: "Owner",
    variant: "default",
    description: "Full account control",
  },
  admin: {
    icon: Shield,
    label: "Admin",
    variant: "secondary",
    description: "Account management",
  },
  member: {
    icon: User,
    label: "Member",
    variant: "outline",
    description: "Standard access",
  },
  viewer: {
    icon: Eye,
    label: "Viewer",
    variant: "outline",
    description: "Read-only access",
  },
};

/**
 * Badge component displaying user role with icon and label.
 *
 * Visual Styling by Role:
 * - Owner: Primary badge with shield-check icon (full control)
 * - Admin: Secondary badge with shield icon (management)
 * - Member: Outline badge with user icon (standard)
 * - Viewer: Outline badge with eye icon (read-only)
 *
 * Usage Example:
 * ```tsx
 * function UserProfile() {
 *   const { userRole } = useAuth();
 *   return <RoleBadge role={userRole} />;
 * }
 * ```
 *
 * @param props - RoleBadgeProps with role and optional className
 * @returns Badge component or null if role is null
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  // Don't render if no role
  if (!role) {
    return null;
  }

  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={className}
      title={config.description}
    >
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}
