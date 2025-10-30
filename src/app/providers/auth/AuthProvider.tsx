import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import { supabase } from "@/core/config";
import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} from "@/core/ipc/db/users";
import { logger } from "@/core/logging";
import { checkIfOrphaned } from "@/modules/auth/utils/orphanDetection";
import { OrphanedUserError, OrphanDetectionError } from "@/modules/auth/errors";
import { initiateCleanupFlow } from "@/modules/auth/utils/cleanupInitiation";
import { useToast } from "@/shared/ui/toast";
import { UserQueries } from "@/core/supabase/queries/users";
import type { UserRole } from "@/shared/types/database";
import { useSubscriptionStatus } from "@/modules/auth/hooks/useSubscriptionStatus";

interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  fullName?: string | null;
  avatarUrl?: string | null;
  accountUuid?: string | null;
  userRole?: UserRole | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  session: Session | null;
  accountUuid: string | null;
  userRole: UserRole | null;
  // TASK 7.2: Subscription status fields
  hasActiveSubscription: boolean;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapUser(supabaseUser: SupabaseUser | null): User | null {
  if (!supabaseUser) return null;

  const email = supabaseUser.email ?? "";
  const derivedName =
    typeof supabaseUser.user_metadata?.full_name === "string"
      ? supabaseUser.user_metadata.full_name
      : email.split("@")[0] ?? "";
  const name = derivedName || email || "Authenticated user";
  const emailVerified = Boolean(supabaseUser.email_confirmed_at);

  return {
    id: supabaseUser.id,
    email,
    name,
    emailVerified,
    fullName: null,
    avatarUrl: null,
  };
}

/**
 * Extracts account_uuid and user_role from JWT claims with fallback query.
 * Implements graceful degradation when custom_access_token_hook not configured.
 *
 * @param supabaseUser - Supabase auth user with JWT payload
 * @returns Object with accountUuid and userRole, or nulls if not available
 */
async function extractAccountContext(
  supabaseUser: SupabaseUser
): Promise<{ accountUuid: string | null; userRole: UserRole | null }> {
  const correlationId = crypto.randomUUID();

  // TASK 4.2: Extract JWT claims from session.user.app_metadata
  const jwtAccountUuid = supabaseUser.app_metadata?.account_uuid as string | undefined;
  const jwtUserRole = supabaseUser.app_metadata?.user_role as string | undefined;

  // Check if JWT claims are present
  if (jwtAccountUuid && jwtUserRole) {
    // TASK 4.2: Validate role is in allowed set
    const allowedRoles: UserRole[] = ['owner', 'admin', 'member', 'viewer'];
    if (!allowedRoles.includes(jwtUserRole as UserRole)) {
      void logger.warn("Invalid user role from JWT claims, defaulting to 'member'", {
        userId: supabaseUser.id,
        correlationId,
        providedRole: jwtUserRole,
        allowedRoles: allowedRoles.join(', '),
      });
      return { accountUuid: jwtAccountUuid, userRole: 'member' };
    }

    // Valid JWT claims - return immediately
    void logger.info("Extracted account context from JWT claims", {
      userId: supabaseUser.id,
      correlationId,
      hasAccountUuid: true,
      hasUserRole: true,
    });

    return {
      accountUuid: jwtAccountUuid,
      userRole: jwtUserRole as UserRole,
    };
  }

  // TASK 4.2: JWT claims missing - implement fallback query logic
  void logger.warn("Custom access token hook not configured. Performance degraded. See documentation.", {
    userId: supabaseUser.id,
    correlationId,
    hasAccountUuid: !!jwtAccountUuid,
    hasUserRole: !!jwtUserRole,
    documentation: "https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook",
  });

  try {
    // Fallback: Query users table for account_uuid and role
    const user = await UserQueries.getUser(supabaseUser.id);

    if (!user) {
      void logger.error("Fallback query returned no user record", {
        userId: supabaseUser.id,
        correlationId,
      });
      return { accountUuid: null, userRole: null };
    }

    // TASK 4.2: Validate role from fallback query
    const allowedRoles: UserRole[] = ['owner', 'admin', 'member', 'viewer'];
    const role = allowedRoles.includes(user.role) ? user.role : 'member';

    if (role !== user.role) {
      void logger.warn("Invalid user role from fallback query, defaulting to 'member'", {
        userId: supabaseUser.id,
        correlationId,
        providedRole: user.role,
        allowedRoles: allowedRoles.join(', '),
      });
    }

    void logger.info("Extracted account context from fallback query", {
      userId: supabaseUser.id,
      correlationId,
      accountUuid: user.account_uuid,
      role,
    });

    return {
      accountUuid: user.account_uuid,
      userRole: role,
    };
  } catch (error) {
    void logger.error("Failed to execute fallback query for account context", {
      userId: supabaseUser.id,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { accountUuid: null, userRole: null };
  }
}

/**
 * Maps Supabase user with profile data from users table.
 * Fetches account_uuid, role, full_name and avatar_url from users table to enrich user context.
 * Implements JWT claims extraction with fallback for account context.
 */
async function mapUserWithProfile(supabaseUser: SupabaseUser | null): Promise<User | null> {
  if (!supabaseUser) return null;

  const baseUser = mapUser(supabaseUser);
  if (!baseUser) return null;

  try {
    // TASK 4.1: Replace ProfileQueries with UserQueries.getUser()
    const userRecord = await UserQueries.getUser(supabaseUser.id);

    // TASK 4.2: Extract account_uuid and user_role from JWT claims with fallback
    const accountContext = await extractAccountContext(supabaseUser);

    if (userRecord) {
      // TASK 4.1: Extract account_uuid and role from users table query result
      // TASK 4.1: Include accountUuid and userRole in user context object
      return {
        ...baseUser,
        fullName: userRecord.first_name && userRecord.last_name
          ? `${userRecord.first_name} ${userRecord.last_name}`
          : null,
        avatarUrl: userRecord.avatar_url,
        accountUuid: accountContext.accountUuid || userRecord.account_uuid,
        userRole: accountContext.userRole || userRecord.role,
      };
    }

    // User record not found - return base user with account context from JWT/fallback
    return {
      ...baseUser,
      accountUuid: accountContext.accountUuid,
      userRole: accountContext.userRole,
    };
  } catch (error) {
    // Log error but don't block authentication if profile fetch fails
    void logger.warn("Failed to fetch user data during login", {
      userId: supabaseUser.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return baseUser;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSyncedUserRef = useRef<string | null>(null);
  const loginInProgress = useRef<boolean>(false); // Prevent duplicate concurrent login calls
  const { toast } = useToast();

  // TASK 7.2: Fetch subscription status during session establishment
  const {
    data: subscriptionStatus,
    isLoading: isSubscriptionLoading,
    error: subscriptionError,
  } = useSubscriptionStatus(user?.accountUuid);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;

        setSession(data.session);
        setUser(mapUser(data.session?.user ?? null));
      } catch (error) {
        void logger.error("Failed to load auth session", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(mapUser(nextSession?.user ?? null));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    // Guard against duplicate concurrent login calls
    if (loginInProgress.current) {
      void logger.warn("Login already in progress - ignoring duplicate call", { email });
      return;
    }

    loginInProgress.current = true;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const supabaseUser = data.user ?? data.session?.user ?? null;
      const verified = Boolean(supabaseUser?.email_confirmed_at);
      if (!verified || !supabaseUser) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        void logger.warn("Blocked login for unverified user", { email });
        throw new Error("Please verify your email before signing in. Check your inbox for the confirmation link.");
      }

      // TASK 4.3: Check if user is orphaned using new checkIfOrphaned function
      try {
        const orphanCheck = await checkIfOrphaned(supabaseUser.id);

        // Log performance metrics for monitoring and optimization
        if (orphanCheck.metrics) {
          const { metrics } = orphanCheck;

          // Log metrics with appropriate level based on performance
          const logLevel = metrics.totalDurationMs > 200 ? 'warn' : 'info';
          const logMessage = `Orphan detection completed (${metrics.totalDurationMs}ms total, ${metrics.queryDurationMs}ms queries)`;

          if (logLevel === 'warn') {
            void logger.warn(logMessage, {
              email,
              userId: supabaseUser.id,
              correlationId: metrics.correlationId,
              totalDurationMs: metrics.totalDurationMs,
              queryDurationMs: metrics.queryDurationMs,
              timedOut: metrics.timedOut,
              hadError: metrics.hadError,
              orphaned: orphanCheck.orphaned,
              orphanType: orphanCheck.orphanType,
              performanceTarget: '< 200ms',
              exceededTarget: true,
            });
          } else {
            void logger.info(logMessage, {
              email,
              userId: supabaseUser.id,
              correlationId: metrics.correlationId,
              totalDurationMs: metrics.totalDurationMs,
              queryDurationMs: metrics.queryDurationMs,
              orphaned: orphanCheck.orphaned,
              orphanType: orphanCheck.orphanType,
            });
          }

          // Track p95 latency for performance monitoring
          // In production, this would push to metrics service (Prometheus, Datadog, etc.)
          if (metrics.totalDurationMs > 500) {
            void logger.warn("Orphan detection exceeded p95 latency target", {
              email,
              userId: supabaseUser.id,
              correlationId: metrics.correlationId,
              totalDurationMs: metrics.totalDurationMs,
              p95Target: 100,
              p99Target: 200,
              exceededBy: metrics.totalDurationMs - 200,
            });
          }
        }

        // TASK 4.3: Throw OrphanedUserError when orphaned=true with specific orphanType
        if (orphanCheck.orphaned) {
          // User is orphaned - immediately sign out and throw OrphanedUserError
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);

          const correlationId = orphanCheck.metrics?.correlationId ?? crypto.randomUUID();
          void logger.warn("Orphaned user detected during login", {
            email,
            userId: supabaseUser.id,
            orphanType: orphanCheck.orphanType,
            hasValidAccount: orphanCheck.hasValidAccount,
            correlationId,
            orphanCheckDurationMs: orphanCheck.metrics?.totalDurationMs,
          });

          throw new OrphanedUserError(email, correlationId);
        }

        // User has profile and membership - proceed with login
        // Fetch profile data to enrich user context
        const userWithProfile = await mapUserWithProfile(supabaseUser);
        setSession(data.session);
        setUser(userWithProfile);
      } catch (orphanError) {
        // If orphanError is OrphanedUserError, rethrow it to trigger recovery flow
        if (orphanError instanceof OrphanedUserError) {
          throw orphanError;
        }

        // If orphanError is OrphanDetectionError, implement fail-closed policy
        if (orphanError instanceof OrphanDetectionError) {
          // Sign out user immediately
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);

          // Log failure with full metrics for monitoring and alerting
          void logger.error("Orphan detection failed after all retry attempts (fail-closed)", {
            email,
            userId: supabaseUser.id,
            correlationId: orphanError.correlationId,
            attemptCount: orphanError.attemptCount,
            metrics: {
              totalDurationMs: orphanError.metrics.totalDurationMs,
              queryDurationMs: orphanError.metrics.queryDurationMs,
              timedOut: orphanError.metrics.timedOut,
              hadError: orphanError.metrics.hadError,
            },
          });

          // Throw blocking error with user-friendly message
          throw new Error(orphanError.getUserMessage());
        }

        // Unexpected error during orphan check - fail-closed for security
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);

        void logger.error("Unexpected error during orphan detection (fail-closed)", {
          email,
          userId: supabaseUser.id,
          error: orphanError instanceof Error ? orphanError.message : String(orphanError),
          stack: orphanError instanceof Error ? orphanError.stack : undefined,
        });

        throw new Error("Authentication system is temporarily unavailable. Please try again in a few minutes. If this problem persists, please contact support.");
      }
    } catch (error) {
      // Handle OrphanedUserError: initiate cleanup flow and redirect to recovery route
      if (error instanceof OrphanedUserError) {
        // Initiate cleanup flow (fire-and-forget)
        void initiateCleanupFlow(error.email, error.correlationId);

        // Display toast notification with clear instructions
        toast({
          title: "Registration Incomplete",
          description: "Your registration was incomplete. Check your email for a verification code to complete setup.",
          variant: "default",
          duration: 8000,
        });

        // Log redirect event
        void logger.info("Redirecting orphaned user to recovery route", {
          email: error.email,
          correlationId: error.correlationId,
          redirectUrl: error.redirectUrl,
        });

        // Create redirect error with recovery route URL
        const redirectError = new Error("REDIRECT_TO_RECOVERY");
        // @ts-expect-error - Adding custom property for redirect URL
        redirectError.redirectUrl = error.redirectUrl;
        throw redirectError;
      }

      // Re-throw other errors
      throw error;
    } finally {
      setIsLoading(false);
      loginInProgress.current = false; // Reset flag in all cases (success, error)
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  };

  const value = useMemo<AuthContextType>(() => {
    const isVerified = Boolean(user?.emailVerified);
    const isAuthenticated = Boolean(session?.user && isVerified);

    // TASK 7.2: Update context values to include subscription status
    // Fail-closed: treat query errors or missing subscription as no active subscription
    const hasActiveSubscription = subscriptionError
      ? false // Fail-closed on error
      : subscriptionStatus?.hasActiveSubscription ?? false;

    const trialEndsAt = subscriptionStatus?.trial_ends_at ?? null;
    const daysRemaining = subscriptionStatus?.daysRemaining ?? null;

    return {
      user,
      isAuthenticated,
      isVerified,
      login,
      logout,
      isLoading: isLoading || isSubscriptionLoading,
      session,
      accountUuid: user?.accountUuid ?? null,
      userRole: user?.userRole ?? null,
      hasActiveSubscription,
      trialEndsAt,
      daysRemaining,
    };
  }, [user, session, isLoading, isSubscriptionLoading, subscriptionStatus, subscriptionError, login, logout]);

  useEffect(() => {
    let disposed = false;

    /**
     * TASK 4.4: Syncs local SQLite user profile for backward compatibility.
     * Maps users table fields to local SQLite profile schema.
     * Syncs account_uuid and role to local profile for offline desktop features.
     *
     * Note: Cloud profiles are auto-created by database trigger (handle_new_user).
     * This function only maintains local SQLite profiles for desktop-specific features.
     */
    async function syncLocalUserProfile(currentUser: User | null) {
      if (!currentUser) {
        lastSyncedUserRef.current = null;
        return;
      }

      if (!currentUser.emailVerified) {
        lastSyncedUserRef.current = null;
        return;
      }

      const identifier = currentUser.id;
      if (!identifier || lastSyncedUserRef.current === identifier) {
        return;
      }

      // TASK 4.4: Map users table fields to local SQLite profile schema
      // Use fullName from users table if available, fallback to name from JWT metadata
      const preferredName = currentUser.fullName?.trim() || currentUser.name?.trim() || currentUser.email;

      // TASK 4.4: Map role from users table to local SQLite roles array format
      // SQLite profile uses roles array, users table has single role field
      const roles = currentUser.userRole ? [currentUser.userRole] : ["member"];

      const context = {
        user_uuid: identifier,
        account_uuid: currentUser.accountUuid,
        role: currentUser.userRole,
      };

      try {
        const existingProfile = await getUserProfile(identifier);
        if (disposed) {
          return;
        }

        // Note: This only manages LOCAL SQLite profile for desktop app features
        // Cloud profiles in Supabase are managed by database trigger
        if (!existingProfile) {
          // TASK 4.4: Create local profile with account_uuid and role from users table
          await createUserProfile({
            userUuid: identifier,
            username: preferredName,
            email: currentUser.email,
            roles,
          });
          if (!disposed) {
            void logger.info("Created local user profile (SQLite)", {
              ...context,
              syncedRoles: roles.join(', '),
            });
          }
        } else {
          const needsNameUpdate = existingProfile.username !== preferredName;
          const needsEmailUpdate = existingProfile.email !== currentUser.email;
          // TASK 4.4: Check if roles need updating (users table role → SQLite roles array)
          const needsRolesUpdate = JSON.stringify(existingProfile.roles) !== JSON.stringify(roles);

          if (needsNameUpdate || needsEmailUpdate || needsRolesUpdate) {
            await updateUserProfile({
              userUuid: identifier,
              username: preferredName,
              email: currentUser.email,
              roles,
            });
            if (!disposed) {
              void logger.info("Updated local user profile (SQLite)", {
                ...context,
                updatedFields: {
                  name: needsNameUpdate,
                  email: needsEmailUpdate,
                  roles: needsRolesUpdate,
                },
                syncedRoles: roles.join(', '),
              });
            }
          }
        }

        if (!disposed) {
          lastSyncedUserRef.current = identifier;
        }
      } catch (error) {
        // TASK 4.4: Handle sync failures gracefully without blocking authentication
        if (!disposed) {
          void logger.error("Failed to sync local user profile (SQLite) - will retry on next login", {
            error,
            ...context,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
        // Note: Sync failure does not block authentication, will retry on next login
      }
    }

    void syncLocalUserProfile(user);

    return () => {
      disposed = true;
    };
  }, [user]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
