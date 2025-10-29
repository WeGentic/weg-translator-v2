-- ==========================================
-- Storage RLS Policies: Company Logos
-- Date: 2025-10-29
-- Description: Row-Level Security policies for company-logos storage bucket
--              Enforces company membership for access, owner/admin for upload
-- ==========================================

-- Note: Storage buckets must be created via Supabase Dashboard or CLI
-- Bucket name: company-logos
-- Public: false (private with RLS)
-- File size limit: 2MB
-- Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp
-- Path convention: {company_id}/logo.{ext}

-- ==========================================
-- DROP existing policies if they exist
-- ==========================================

DROP POLICY IF EXISTS company_logos_select_policy ON storage.objects;
DROP POLICY IF EXISTS company_logos_insert_policy ON storage.objects;
DROP POLICY IF EXISTS company_logos_update_policy ON storage.objects;
DROP POLICY IF EXISTS company_logos_delete_policy ON storage.objects;

-- ==========================================
-- SELECT Policy: Members can view logos
-- ==========================================

CREATE POLICY company_logos_select_policy ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (
        SELECT company_id
        FROM company_members
        WHERE user_id = auth.uid()
    )
);

-- ==========================================
-- INSERT Policy: Owners and admins can upload
-- ==========================================

CREATE POLICY company_logos_insert_policy ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (
        SELECT company_id
        FROM company_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- ==========================================
-- UPDATE Policy: Owners and admins can update
-- ==========================================

CREATE POLICY company_logos_update_policy ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (
        SELECT company_id
        FROM company_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- ==========================================
-- DELETE Policy: Only owners can delete
-- ==========================================

CREATE POLICY company_logos_delete_policy ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (
        SELECT company_id
        FROM company_members
        WHERE user_id = auth.uid()
        AND role = 'owner'
    )
);

-- ==========================================
-- Validation
-- ==========================================

-- Verify policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE 'company_logos%'
ORDER BY policyname;
