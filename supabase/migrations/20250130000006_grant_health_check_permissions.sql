-- ============================================================================
-- GRANT PERMISSIONS FOR HEALTH CHECK TABLE
-- ============================================================================
-- This migration adds SELECT permissions for anonymous and authenticated users
-- to access the health_check table for database health monitoring.
-- ============================================================================

-- Grant SELECT permission to anonymous users (unauthenticated)
-- This allows the health check to work on the login page before authentication
GRANT SELECT ON public.health_check TO anon;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON public.health_check TO authenticated;
