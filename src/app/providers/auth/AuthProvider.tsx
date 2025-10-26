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

      setSession(data.session);
      setUser(mapUser(supabaseUser));
    } finally {
      setIsLoading(false);
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
