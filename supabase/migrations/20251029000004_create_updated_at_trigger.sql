-- ==========================================
-- Migration: Create Updated_at Trigger
-- Date: 2025-10-29
-- Description: Creates trigger function and triggers to automatically
--              update the updated_at timestamp on row modifications
-- Requirements: Req #4
-- ==========================================

-- Create trigger function to set updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION public.set_updated_at_timestamp() IS 'Trigger function to automatically update updated_at timestamp on row modifications';

-- ==========================================
-- Apply trigger to companies table
-- ==========================================

DROP TRIGGER IF EXISTS set_companies_updated_at ON public.companies;

CREATE TRIGGER set_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ==========================================
-- Apply trigger to profiles table
-- ==========================================

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ==========================================
-- Apply trigger to company_members table
-- ==========================================

DROP TRIGGER IF EXISTS set_company_members_updated_at ON public.company_members;

CREATE TRIGGER set_company_members_updated_at
BEFORE UPDATE ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ==========================================
-- Rollback Instructions (for reference)
-- ==========================================
-- To rollback this migration:
-- DROP TRIGGER IF EXISTS set_companies_updated_at ON public.companies;
-- DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
-- DROP TRIGGER IF EXISTS set_company_members_updated_at ON public.company_members;
-- DROP FUNCTION IF EXISTS public.set_updated_at_timestamp();
