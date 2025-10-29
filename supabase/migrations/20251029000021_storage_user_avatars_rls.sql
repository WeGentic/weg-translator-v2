-- ==========================================
-- Storage RLS Policies: User Avatars
-- Date: 2025-10-29
-- Description: Row-Level Security policies for user-avatars storage bucket
--              Users can manage own avatar, co-members can view
-- ==========================================

-- Note: Storage buckets must be created via Supabase Dashboard or CLI
-- Bucket name: user-avatars
-- Public: false (private with RLS)
-- File size limit: 1MB
-- Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp
-- Path convention: {user_id}/avatar.{ext}

-- ==========================================
-- DROP existing policies if they exist
-- ==========================================

DROP POLICY IF EXISTS user_avatars_select_policy ON storage.objects;
DROP POLICY IF EXISTS user_avatars_insert_policy ON storage.objects;
DROP POLICY IF EXISTS user_avatars_update_policy ON storage.objects;
DROP POLICY IF EXISTS user_avatars_delete_policy ON storage.objects;

-- ==========================================
-- SELECT Policy: Own avatar + co-member avatars
-- ==========================================

CREATE POLICY user_avatars_select_policy ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-avatars'
    AND (
        -- Own avatar
        (storage.foldername(name))[1]::uuid = auth.uid()
        OR
        -- Co-member avatars (users in same company)
        (storage.foldername(name))[1]::uuid IN (
            SELECT cm2.user_id
            FROM company_members cm1
            JOIN company_members cm2 ON cm1.company_id = cm2.company_id
            WHERE cm1.user_id = auth.uid()
        )
    )
);

-- ==========================================
-- INSERT Policy: Users can only upload own avatar
-- ==========================================

CREATE POLICY user_avatars_insert_policy ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
);

-- ==========================================
-- UPDATE Policy: Users can only update own avatar
-- ==========================================

CREATE POLICY user_avatars_update_policy ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
);

-- ==========================================
-- DELETE Policy: Users can only delete own avatar
-- ==========================================

CREATE POLICY user_avatars_delete_policy ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
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
AND policyname LIKE 'user_avatars%'
ORDER BY policyname;
