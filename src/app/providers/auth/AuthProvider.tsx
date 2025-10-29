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

interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  session: Session | null;
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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSyncedUserRef = useRef<string | null>(null);
  const loginInProgress = useRef<boolean>(false); // Prevent duplicate concurrent login calls
  const { toast } = useToast();

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

      // Check if user is orphaned (has no company data)
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
              isOrphaned: orphanCheck.isOrphaned,
              classification: orphanCheck.classification,
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
              isOrphaned: orphanCheck.isOrphaned,
              classification: orphanCheck.classification,
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

        if (orphanCheck.isOrphaned) {
          // User is orphaned - immediately sign out and throw OrphanedUserError
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);

          const correlationId = orphanCheck.metrics?.correlationId ?? crypto.randomUUID();
          void logger.warn("Orphaned user detected during login", {
            email,
            userId: supabaseUser.id,
            classification: orphanCheck.classification,
            correlationId,
            orphanCheckDurationMs: orphanCheck.metrics?.totalDurationMs,
          });

          throw new OrphanedUserError(email, correlationId);
        }

        // User has company data - proceed with login
        setSession(data.session);
        setUser(mapUser(supabaseUser));
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

    return {
      user,
      isAuthenticated,
      isVerified,
      login,
      logout,
      isLoading,
      session,
    };
  }, [user, session, isLoading, login, logout]);

  useEffect(() => {
    let disposed = false;

    async function ensureDomainUserProfile(currentUser: User | null) {
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

      const preferredName = currentUser.name?.trim() || currentUser.email;
      const context = { user_uuid: identifier };

      try {
        const existingProfile = await getUserProfile(identifier);
        if (disposed) {
          return;
        }

        if (!existingProfile) {
          await createUserProfile({
            userUuid: identifier,
            username: preferredName,
            email: currentUser.email,
            roles: ["owner"],
          });
          if (!disposed) {
            void logger.info("Created local user profile", context);
          }
        } else {
          const needsNameUpdate = existingProfile.username !== preferredName;
          const needsEmailUpdate = existingProfile.email !== currentUser.email;

          if (needsNameUpdate || needsEmailUpdate) {
            await updateUserProfile({
              userUuid: identifier,
              username: preferredName,
              email: currentUser.email,
            });
            if (!disposed) {
              void logger.info("Updated local user profile", context);
            }
          }
        }

        if (!disposed) {
          lastSyncedUserRef.current = identifier;
        }
      } catch (error) {
        if (!disposed) {
          void logger.error("Failed to sync local user profile", error, context);
        }
      }
    }

    void ensureDomainUserProfile(user);

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
