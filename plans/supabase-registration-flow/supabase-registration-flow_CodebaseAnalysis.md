## Current Codebase Assessment

### Repository Context
- Desktop-focused Tauri 2 + React 19 application with TypeScript front-end (`src/`) and Rust backend (`src-tauri/`). React compiler and TanStack Router v1 manage UI/routing.
- Auth is centrally managed via `AuthProvider` (`src/app/providers/auth/AuthProvider.tsx`) wrapping the app shell; it already depends on a Supabase client defined in `src/core/config/supabaseClient.ts`.

### Supabase Integration Status
- `supabaseClient.ts` instantiates a browser Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, enforcing presence at startup and enabling session persistence (`storageKey: "weg-translator-auth"`).
- Auth provider handles session bootstrap, sign-in with password, sign-out, and subscribes to `onAuthStateChange`. It also syncs local “domain” user profiles via Tauri IPC (`createUserProfile`, `updateUserProfile`) once a Supabase session is active.
- No existing flow calls `supabase.auth.signUp`. Registration logic currently runs entirely on the client with no Supabase writeback.

### Registration UI & Logic
- Route `/register` maps to `RegistrationRoute` (`src/modules/auth/routes/RegistrationRoute.tsx`), rendering `RegistrationForm`.
- `RegistrationForm` composes multi-step UI (company details, admin details) with validation messaging, and forwards business logic to `useRegistrationForm`.
- `useRegistrationForm` (`src/modules/auth/hooks/controllers/useRegistrationForm.ts`) orchestrates state for all form fields, phone/address helpers, step navigation, and validation. However `handleSubmit` only blocks duplicate submits, runs validation, then simulates latency via `setTimeout`—no persistence or Supabase interaction occurs.
- Validation utilities (`src/modules/auth/utils/validation/*`) already enforce company/admin data requirements (VAT patterns, password policy).

### Supporting Infrastructure
- TanStack Router root ensures auth context. Login route exists (`src/router/routes/login.tsx`) and login form uses Supabase password sign-in.
- Shared UI components (Shadcn-based) and styling follow modular CSS per component under `src/modules/auth/routes/css`.
- Backend (Rust) persists local user metadata in SQLite; Supabase integration will need to reconcile local vs cloud data creation.

### Hotspots & Gaps
- Registration flow lacks: Supabase sign-up call, email verification gate, polling/listening mechanism, profile/org persistence in Supabase, failure rollbacks, and navigation handshake with local profile creation.
- Supabase Edge Functions directory (`supabase/functions/`) is empty; no server-side logic exists yet for transactional org setup.
- No SQL migrations/scripts exist for Supabase schema; all data definitions are on the local side only.
- RLS policies not represented in repo; need explicit plan for secure Supabase usage.
- Error handling pattern for async form submission not yet defined (e.g., toast notifications, field-level messages).

### Opportunities & Constraints
- Must avoid embedding service-role keys; only anon key available at runtime.
- Email verification is mandated before login; need to ensure AuthProvider or registration flow enforces `email_confirmed_at` before unlocking UI.
- Existing phone/address helpers rely on browser APIs; ensure compatibility when running in Tauri WebView.
- Need to integrate Supabase data with multi-tenant company schema; currently local profile sync assumes simple user record.
