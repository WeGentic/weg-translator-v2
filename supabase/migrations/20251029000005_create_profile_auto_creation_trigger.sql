-- ==========================================
-- Migration: Create Profile Auto-Creation Trigger
-- Date: 2025-10-29
-- Description: Creates trigger to automatically create profile records
--              when new users sign up through Supabase Auth
-- Requirements: Req #5
-- Security: Uses SECURITY DEFINER with explicit search_path to prevent attacks
-- ==========================================

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Validate that user ID is not NULL
    IF NEW.id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be NULL';
    END IF;

    -- Create profile with error handling (do not fail signup on profile creation error)
    BEGIN
        INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
            NOW(),
            NOW()
        );
    EXCEPTION
        WHEN unique_violation THEN
            -- Profile already exists, skip
            RAISE WARNING 'Profile already exists for user %', NEW.id;
        WHEN OTHERS THEN
            -- Log error but don't fail signup
            RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to automatically create profile when user signs up (SECURITY DEFINER with explicit search_path for security)';

-- ==========================================
-- Create AFTER INSERT trigger on auth.users
-- ==========================================

DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

CREATE TRIGGER handle_new_user_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- Grant EXECUTE permission to authenticated users
-- ==========================================

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- Revoke CREATE on schema public from PUBLIC for security hardening
-- (prevents unprivileged users from creating objects in public schema)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ==========================================
-- Rollback Instructions (for reference)
-- ==========================================
-- To rollback this migration:
-- DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- GRANT CREATE ON SCHEMA public TO PUBLIC; -- Restore CREATE permission if needed
