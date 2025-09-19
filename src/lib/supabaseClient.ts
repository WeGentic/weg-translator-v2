import { createClient } from "@supabase/supabase-js";

type SupabaseUrl = string & { __brand?: "SupabaseUrl" };
type SupabaseKey = string & { __brand?: "SupabaseAnonKey" };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as SupabaseUrl | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as SupabaseKey | undefined;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "weg-translator-auth",
  },
});
