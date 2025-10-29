-- ==========================================
-- Migration: Create Companies Table
-- Date: 2025-10-29
-- Description: Creates companies table with separate address columns,
--              VAT ID unique constraint, email validation, and indexes
-- Requirements: Req #1
-- ==========================================

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vat_id TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postal_code TEXT,
    address_country TEXT,
    address_freeform TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on vat_id (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'companies_vat_id_key'
        AND conrelid = 'public.companies'::regclass
    ) THEN
        ALTER TABLE public.companies ADD CONSTRAINT companies_vat_id_key UNIQUE (vat_id);
    END IF;
END $$;

-- Add CHECK constraint on email format (idempotent with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'companies_email_check'
        AND conrelid = 'public.companies'::regclass
    ) THEN
        ALTER TABLE public.companies
        ADD CONSTRAINT companies_email_check
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');
    END IF;
END $$;

-- Create indexes for companies table
CREATE INDEX IF NOT EXISTS idx_companies_vat_id ON public.companies(vat_id);
CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON public.companies(created_at);
CREATE INDEX IF NOT EXISTS idx_companies_address_city ON public.companies(address_city);
CREATE INDEX IF NOT EXISTS idx_companies_address_country ON public.companies(address_country);

-- Add comment to table
COMMENT ON TABLE public.companies IS 'Stores organization/business entities with multi-tenant isolation';

-- Add column comments
COMMENT ON COLUMN public.companies.id IS 'Unique company identifier';
COMMENT ON COLUMN public.companies.name IS 'Company legal or display name';
COMMENT ON COLUMN public.companies.vat_id IS 'Unique VAT/Tax identification number';
COMMENT ON COLUMN public.companies.email IS 'Primary company contact email (validated format)';
COMMENT ON COLUMN public.companies.phone IS 'Company contact phone number';
COMMENT ON COLUMN public.companies.address_line1 IS 'Street address line 1';
COMMENT ON COLUMN public.companies.address_line2 IS 'Street address line 2 (apt, suite, etc.)';
COMMENT ON COLUMN public.companies.address_city IS 'City name';
COMMENT ON COLUMN public.companies.address_state IS 'State/Province/Region';
COMMENT ON COLUMN public.companies.address_postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN public.companies.address_country IS 'Country name or ISO code';
COMMENT ON COLUMN public.companies.address_freeform IS 'Unstructured address fallback for international formats';
COMMENT ON COLUMN public.companies.logo_url IS 'Supabase Storage path reference for company logo';
COMMENT ON COLUMN public.companies.created_at IS 'Timestamp when company was created';
COMMENT ON COLUMN public.companies.updated_at IS 'Timestamp when company was last updated (auto-managed by trigger)';

-- ==========================================
-- Rollback Instructions (for reference)
-- ==========================================
-- To rollback this migration:
-- DROP TABLE IF EXISTS public.companies CASCADE;
