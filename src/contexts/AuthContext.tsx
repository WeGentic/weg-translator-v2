import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import { supabase } from "../lib/supabaseClient";
import { logger } from "../logging";

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
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

  return {
    id: supabaseUser.id,
    email,
    name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

      setSession(data.session);
      setUser(mapUser(data.session?.user ?? data.user ?? null));
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

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!session?.user,
      login,
      logout,
      isLoading,
      session,
    }),
    [user, session, isLoading],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
