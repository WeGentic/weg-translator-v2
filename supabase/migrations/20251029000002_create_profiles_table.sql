-- ==========================================
-- Migration: Create Profiles Table
-- Date: 2025-10-29
-- Description: Creates profiles table extending auth.users with
--              application-specific user metadata
-- Requirements: Req #2
-- ==========================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraint to auth.users (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_id_fkey'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index on full_name for user search functionality
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);

-- Add comment to table
COMMENT ON TABLE public.profiles IS 'Extends auth.users with application-specific user metadata (1:1 relationship)';

-- Add column comments
COMMENT ON COLUMN public.profiles.id IS 'User identifier (FK to auth.users.id with CASCADE delete)';
COMMENT ON COLUMN public.profiles.full_name IS 'User full display name (extracted from metadata on signup)';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Supabase Storage path reference for user avatar image';
COMMENT ON COLUMN public.profiles.created_at IS 'Timestamp when profile was created';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp when profile was last updated (auto-managed by trigger)';

-- ==========================================
-- Rollback Instructions (for reference)
-- ==========================================
-- To rollback this migration:
-- DROP TABLE IF EXISTS public.profiles CASCADE;
