-- ==========================================
-- Migration: Create Company Members Junction Table
-- Date: 2025-10-29
-- Description: Creates company_members table managing many-to-many
--              relationships between users and companies with role information
-- Requirements: Req #3
-- ==========================================

-- Create company_members table
CREATE TABLE IF NOT EXISTS public.company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    invited_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraint to companies (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'company_members_company_id_fkey'
        AND conrelid = 'public.company_members'::regclass
    ) THEN
        ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to profiles (user_id) (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'company_members_user_id_fkey'
        AND conrelid = 'public.company_members'::regclass
    ) THEN
        ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to profiles (invited_by) (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'company_members_invited_by_fkey'
        AND conrelid = 'public.company_members'::regclass
    ) THEN
        ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_invited_by_fkey
        FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add CHECK constraint on role (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'company_members_role_check'
        AND conrelid = 'public.company_members'::regclass
    ) THEN
        ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_role_check
        CHECK (role IN ('owner', 'admin', 'member'));
    END IF;
END $$;

-- Add unique constraint on (company_id, user_id) (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'company_members_unique_membership'
        AND conrelid = 'public.company_members'::regclass
    ) THEN
        ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_unique_membership
        UNIQUE (company_id, user_id);
    END IF;
END $$;

-- Create indexes for company_members table
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_role ON public.company_members(company_id, role);

-- Add comment to table
COMMENT ON TABLE public.company_members IS 'Junction table managing many-to-many relationships between users and companies with role-based access control';

-- Add column comments
COMMENT ON COLUMN public.company_members.id IS 'Unique membership identifier';
COMMENT ON COLUMN public.company_members.company_id IS 'Company reference (FK to companies.id with CASCADE delete)';
COMMENT ON COLUMN public.company_members.user_id IS 'User reference (FK to profiles.id with CASCADE delete)';
COMMENT ON COLUMN public.company_members.role IS 'User role within company (owner, admin, or member)';
COMMENT ON COLUMN public.company_members.invited_by IS 'Profile ID of user who invited this member (FK with SET NULL on delete)';
COMMENT ON COLUMN public.company_members.created_at IS 'Timestamp when membership was created';
COMMENT ON COLUMN public.company_members.updated_at IS 'Timestamp when membership was last updated (auto-managed by trigger)';

-- ==========================================
-- Rollback Instructions (for reference)
-- ==========================================
-- To rollback this migration:
-- DROP TABLE IF EXISTS public.company_members CASCADE;
