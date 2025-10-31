-- ============================================================================
-- HEALTH CHECK TABLE
-- ============================================================================
-- This table is used exclusively for database health monitoring.
-- It provides a lightweight, unauthenticated endpoint that allows the
-- application to verify Supabase connectivity and database health without
-- requiring user authentication or triggering RLS policies.
--
-- The table contains a single row that serves as a query target for
-- health check operations using: SELECT 1 FROM health_check LIMIT 1
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.health_check (
  id serial PRIMARY KEY,
  checked_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Disable RLS to allow unauthenticated health check queries
-- This is safe because the table contains no sensitive data and is read-only
-- for application health monitoring purposes
ALTER TABLE public.health_check DISABLE ROW LEVEL SECURITY;

-- Grant SELECT permission to anonymous users (unauthenticated)
-- This allows the health check to work on the login page before authentication
GRANT SELECT ON public.health_check TO anon;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON public.health_check TO authenticated;

-- Insert a single default row for health check queries to target
-- This ensures SELECT queries always have data to return
INSERT INTO public.health_check (checked_at)
VALUES (now())
ON CONFLICT DO NOTHING;

-- Add a comment documenting the table's purpose
COMMENT ON TABLE public.health_check IS
  'Lightweight table for database health monitoring. Contains a single row used by the application to verify Supabase connectivity without authentication. RLS is disabled to allow unauthenticated access.';

COMMENT ON COLUMN public.health_check.id IS
  'Serial primary key for unique identification.';

COMMENT ON COLUMN public.health_check.checked_at IS
  'Timestamp of the last health check update. Defaults to current timestamp on creation.';
