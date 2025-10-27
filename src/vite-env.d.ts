/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
  readonly VITE_FEATURE_PROJECT_MANAGER_V2?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
