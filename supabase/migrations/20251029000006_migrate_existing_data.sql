-- ==========================================
-- Migration: Migrate Existing Data to New Schema
-- Date: 2025-10-29
-- Description: Migrates data from current schema to new schema
--              - Populates profiles from auth.users
--              - Migrates company_admins to company_members
--              - Updates companies table structure if needed
-- Requirements: Req #24
-- ==========================================

-- ==========================================
-- Step 1: Populate profiles from auth.users
-- ==========================================

-- Insert profiles for all existing auth.users
-- ON CONFLICT DO NOTHING ensures idempotency
INSERT INTO public.profiles (id, full_name, created_at, updated_at)
SELECT
    id,
    raw_user_meta_data->>'full_name' AS full_name,
    created_at,
    updated_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Log profile migration count
DO $$
DECLARE
    profile_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    RAISE NOTICE 'Migrated % profiles from auth.users', profile_count;
END $$;

-- ==========================================
-- Step 2: Migrate company_admins to company_members
-- (Only if company_admins table exists)
-- ==========================================

DO $$
BEGIN
    -- Check if company_admins table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'company_admins'
    ) THEN
        -- Migrate data from company_admins to company_members
        -- First admin per company gets 'owner' role, others get 'admin' role
        INSERT INTO public.company_members (company_id, user_id, role, created_at, updated_at)
        SELECT
            ca.company_id,
            ca.admin_uuid AS user_id,
            CASE
                WHEN ca.admin_uuid = (
                    SELECT admin_uuid
                    FROM company_admins
                    WHERE company_id = ca.company_id
                    ORDER BY created_at ASC
                    LIMIT 1
                ) THEN 'owner'
                ELSE 'admin'
            END AS role,
            ca.created_at,
            ca.updated_at
        FROM company_admins ca
        ON CONFLICT (company_id, user_id) DO NOTHING;

        RAISE NOTICE 'Migrated company_admins to company_members';
    ELSE
        RAISE NOTICE 'company_admins table does not exist, skipping migration';
    END IF;
END $$;

-- ==========================================
-- Step 3: Add logo_url column to companies if not exists
-- ==========================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'companies'
        AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE public.companies ADD COLUMN logo_url TEXT;
        RAISE NOTICE 'Added logo_url column to companies table';
    ELSE
        RAISE NOTICE 'logo_url column already exists in companies table';
    END IF;
END $$;

-- ==========================================
-- Step 4: Migrate address data if using different structure
-- (Check if old address columns exist and migrate to new structure)
-- ==========================================

DO $$
DECLARE
    has_old_address BOOLEAN;
BEGIN
    -- Check if old address structure exists (e.g., address_country_code instead of address_country)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'companies'
        AND column_name = 'address_country_code'
    ) INTO has_old_address;

    IF has_old_address THEN
        -- Migrate address_country_code to address_country if needed
        UPDATE public.companies
        SET address_country = address_country_code
        WHERE address_country IS NULL AND address_country_code IS NOT NULL;

        RAISE NOTICE 'Migrated address data from old structure';
    ELSE
        RAISE NOTICE 'No old address structure detected, skipping address migration';
    END IF;
END $$;

-- ==========================================
-- Validation Queries
-- ==========================================

-- Check: All auth.users have profiles
DO $$
DECLARE
    users_without_profiles INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_without_profiles
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE p.id IS NULL;

    IF users_without_profiles > 0 THEN
        RAISE WARNING '% auth.users do not have profiles', users_without_profiles;
    ELSE
        RAISE NOTICE 'SUCCESS: All auth.users have profiles';
    END IF;
END $$;

-- Check: All companies have at least one owner
DO $$
DECLARE
    companies_without_owners INTEGER;
BEGIN
    SELECT COUNT(*) INTO companies_without_owners
    FROM public.companies c
    LEFT JOIN public.company_members cm ON c.id = cm.company_id AND cm.role = 'owner'
    WHERE cm.id IS NULL;

    IF companies_without_owners > 0 THEN
        RAISE WARNING '% companies do not have an owner', companies_without_owners;
    ELSE
        RAISE NOTICE 'SUCCESS: All companies have at least one owner';
    END IF;
END $$;

-- Check: No orphaned memberships
DO $$
DECLARE
    orphaned_memberships INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_memberships
    FROM public.company_members cm
    LEFT JOIN public.profiles p ON cm.user_id = p.id
    LEFT JOIN public.companies c ON cm.company_id = c.id
    WHERE p.id IS NULL OR c.id IS NULL;

    IF orphaned_memberships > 0 THEN
        RAISE WARNING '% orphaned memberships detected', orphaned_memberships;
    ELSE
        RAISE NOTICE 'SUCCESS: No orphaned memberships detected';
    END IF;
END $$;

-- ==========================================
-- Rollback Procedure (for reference)
-- ==========================================
-- To rollback this migration:
-- 1. Delete migrated profiles: DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users);
-- 2. Delete migrated memberships: DELETE FROM public.company_members;
-- 3. Drop logo_url column if added: ALTER TABLE public.companies DROP COLUMN IF EXISTS logo_url;
-- 4. Restore company_admins data if backed up
