# Schema Management Guide

**Last Updated**: 2025-10-29
**Status**: Production Ready
**Target Audience**: Developers, Database Administrators

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Schema Management Approach](#schema-management-approach)
3. [Migration Workflow](#migration-workflow)
4. [RLS Policy Best Practices](#rls-policy-best-practices)
5. [Trigger Security Considerations](#trigger-security-considerations)
6. [Schema Diagram](#schema-diagram)
7. [Storage Bucket Configuration](#storage-bucket-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

---

## Philosophy

### Developer-Managed, Not Application-Managed

**Core Principle**: Database schemas MUST be managed by developers through SQL migrations, NOT by application code.

#### Why This Matters

1. **Security**: Application code with schema modification capabilities creates attack vectors
2. **Reliability**: Schema changes are one-way operations that can corrupt data if done incorrectly
3. **Audibility**: SQL migrations provide a clear audit trail of schema evolution
4. **Testability**: Migrations can be tested in isolation before production deployment
5. **Rollback Safety**: Explicit migrations allow explicit rollback procedures

#### What This Means

✅ **Correct Approach**:
- Write SQL migration files for all schema changes
- Test migrations in development environment
- Review migrations in pull requests
- Apply migrations through Supabase CLI or dashboard
- Version control all migration files

❌ **Incorrect Approach**:
- Creating tables dynamically in application code
- Using raw SQL execution from user input
- Modifying schemas based on runtime conditions
- DDL statements in TypeScript or Rust application code
- Schema generation from ORM frameworks in production

---

## Schema Management Approach

### Schema Ownership

**Supabase PostgreSQL (Cloud)**:
- User profiles (extends `auth.users`)
- Company data (multi-tenant entities)
- Company memberships (role-based access)
- Storage buckets (logos, avatars)

**SQLite (Local - Tauri managed)**:
- Translation projects
- Project files and artifacts
- Translation jobs and history
- Client records (separate from cloud companies)

**No Synchronization**: These databases serve different purposes and do not sync.

### Current Schema Overview

#### Tables

1. **`companies`** - Organization entities
   - Multi-tenant isolation via RLS
   - Stores company metadata (name, VAT ID, email, address)
   - Links to `company_members` for access control

2. **`profiles`** - User metadata extending auth.users
   - 1:1 relationship with `auth.users`
   - Stores display name, avatar URL
   - Automatically created by trigger on user signup

3. **`company_members`** - Many-to-many junction table
   - Links users to companies with roles
   - Roles: `owner`, `admin`, `member`
   - Enforces tenant isolation via RLS

#### Schema Relationships

```
auth.users (Supabase Auth)
    ↓ 1:1 CASCADE
profiles
    ↓ 1:N CASCADE
company_members
    ↓ N:1 CASCADE
companies
```

**Cascade Behavior**:
- Deleting user → deletes profile → deletes memberships
- Deleting company → deletes all memberships
- Maintains referential integrity automatically

---

## Migration Workflow

### Creating New Migrations

#### Step 1: Write SQL Migration File

Create a new file in your migrations directory (or Supabase dashboard):

```sql
-- Migration: Add column for company website
-- Date: 2025-10-29
-- Description: Add optional website URL to companies table

BEGIN;

-- Use IF NOT EXISTS for idempotency
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'website_url'
    ) THEN
        ALTER TABLE public.companies
        ADD COLUMN website_url TEXT;
    END IF;
END $$;

-- Add validation constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'companies_website_url_format'
    ) THEN
        ALTER TABLE public.companies
        ADD CONSTRAINT companies_website_url_format
        CHECK (website_url ~* '^https?://.*');
    END IF;
END $$;

COMMIT;
```

#### Step 2: Test Locally

```bash
# Start local Supabase instance
supabase start

# Apply migration
supabase db push

# Test multiple times to verify idempotency
supabase db reset
supabase db push
supabase db push  # Should succeed without errors
```

#### Step 3: Review in Pull Request

- Include migration file in PR
- Document expected behavior
- Note any data transformations
- Highlight breaking changes (if any)

#### Step 4: Apply to Production

```bash
# Via Supabase CLI (recommended)
supabase db push --db-url $PRODUCTION_DB_URL

# Or via Supabase Dashboard
# Go to SQL Editor → paste migration → run
```

### Idempotency Requirements

**Every migration MUST be idempotent** (safe to run multiple times).

#### Idempotent Patterns

**Tables**:
```sql
CREATE TABLE IF NOT EXISTS table_name (...);
```

**Indexes**:
```sql
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);
```

**Functions**:
```sql
CREATE OR REPLACE FUNCTION function_name() RETURNS ...
```

**Triggers**:
```sql
DROP TRIGGER IF EXISTS trigger_name ON table_name;
CREATE TRIGGER trigger_name ...
```

**Policies**:
```sql
DROP POLICY IF EXISTS policy_name ON table_name;
CREATE POLICY policy_name ...
```

**Constraints**:
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'constraint_name'
    ) THEN
        ALTER TABLE table_name ADD CONSTRAINT constraint_name ...;
    END IF;
END $$;
```

### Running Migrations

#### Development Environment

```bash
# Reset database to clean state
supabase db reset

# Push all migrations
supabase db push

# Verify schema
supabase db diff
```

#### Production Environment

```bash
# ALWAYS backup first!
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migrations
supabase db push --db-url $PRODUCTION_DB_URL

# Verify application functionality
# Monitor logs for errors
```

#### Testing Migrations Locally

```bash
# 1. Clone production database to local
supabase db pull

# 2. Apply new migration locally
supabase db push

# 3. Test application with migrated schema
npm run dev

# 4. If successful, apply to production
```

---

## RLS Policy Best Practices

### Fail-Closed Policy Approach

**Principle**: Policies should deny access by default and explicitly grant access.

#### Good Policy Example

```sql
-- Users can only view companies they are members of
CREATE POLICY companies_select_policy ON companies
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM company_members
        WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
    )
);
```

**Why This Works**:
- If `auth.uid()` is NULL (unauthenticated), `EXISTS` returns false
- If query fails, access denied by default
- Explicit membership check required

#### Bad Policy Example

```sql
-- ❌ DANGEROUS: Allows all authenticated users
CREATE POLICY companies_select_policy ON companies
FOR SELECT
TO authenticated
USING (true);
```

### Using auth.uid() for User Context

**Always use** `auth.uid()` to get the current authenticated user:

```sql
-- Correct: Check current user matches resource owner
profiles.id = auth.uid()

-- Correct: Check current user is member
EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.user_id = auth.uid()
)
```

**Never hardcode** user IDs or accept them from client:

```sql
-- ❌ DANGEROUS: Client could inject any user_id
profiles.id = $1  -- Don't do this!
```

### Performance Considerations

#### Index Foreign Keys

**All foreign key columns MUST have indexes** for RLS performance:

```sql
-- Companies membership check uses these indexes
CREATE INDEX idx_company_members_user_id ON company_members(user_id);
CREATE INDEX idx_company_members_company_id ON company_members(company_id);

-- Role-filtered queries benefit from composite index
CREATE INDEX idx_company_members_company_role
ON company_members(company_id, role);
```

#### Use EXISTS Over Subqueries

```sql
-- ✅ Good: EXISTS stops at first match
WHERE EXISTS (
    SELECT 1 FROM company_members ...
)

-- ❌ Slower: Subquery evaluates all matches
WHERE company_id IN (
    SELECT company_id FROM company_members ...
)
```

#### Avoid Functions in WHERE Clauses

```sql
-- ❌ Slow: Function prevents index usage
WHERE LOWER(email) = 'user@example.com'

-- ✅ Fast: Direct comparison uses index
WHERE email = 'user@example.com'
```

### Common Policy Patterns

#### Pattern 1: Own Resource Access

```sql
-- Users can only access their own profile
CREATE POLICY profiles_update_policy ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid());
```

#### Pattern 2: Company Member Access

```sql
-- Users can view companies they belong to
CREATE POLICY companies_select_policy ON companies
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM company_members
        WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
    )
);
```

#### Pattern 3: Role-Based Access

```sql
-- Only owners can delete companies
CREATE POLICY companies_delete_policy ON companies
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM company_members
        WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
        AND company_members.role = 'owner'
    )
);
```

#### Pattern 4: Co-Member Access

```sql
-- Users can view profiles of people in their companies
CREATE POLICY profiles_select_policy ON profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()  -- Own profile
    OR EXISTS (
        SELECT 1
        FROM company_members cm1
        JOIN company_members cm2 ON cm1.company_id = cm2.company_id
        WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.id
    )
);
```

---

## Trigger Security Considerations

### SECURITY DEFINER Best Practices

**Triggers using SECURITY DEFINER run with creator's privileges**, requiring extra security measures.

#### Always Set search_path

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public  -- ✅ Prevents hijacking
AS $$
BEGIN
    -- Function body
END;
$$;
```

**Why**: Prevents [search_path hijacking attacks](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH).

#### Validate All Inputs

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- ✅ Validate input
    IF NEW.id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be NULL';
    END IF;

    -- Safe to proceed
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$;
```

#### Handle Errors Gracefully

**Critical triggers should not fail parent operations**:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    BEGIN
        -- Attempt profile creation
        INSERT INTO public.profiles (id, full_name, created_at, updated_at)
        VALUES (NEW.id, ..., NOW(), NOW());
    EXCEPTION
        WHEN unique_violation THEN
            -- Profile exists, skip
            RAISE WARNING 'Profile already exists for user %', NEW.id;
        WHEN OTHERS THEN
            -- Log error but don't fail user signup
            RAISE WARNING 'Profile creation failed: %', SQLERRM;
    END;

    RETURN NEW;  -- ✅ Always return NEW for AFTER INSERT
END;
$$;
```

### Error Handling Patterns

#### Pattern 1: Continue on Error

```sql
-- For non-critical operations
BEGIN
    INSERT INTO audit_log ...;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Audit logging failed: %', SQLERRM;
        -- Continue execution
END;
```

#### Pattern 2: Fail Fast

```sql
-- For critical operations
BEGIN
    UPDATE critical_data SET status = 'processed';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Critical record not found';
    END IF;
END;
```

---

## Schema Diagram

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        auth.users (Supabase Auth)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ id (UUID) PK                                              │   │
│  │ email (TEXT)                                              │   │
│  │ email_confirmed_at (TIMESTAMPTZ)                         │   │
│  │ raw_user_meta_data (JSONB)                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:1 CASCADE
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                           profiles                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ id (UUID) PK, FK → auth.users(id) ON DELETE CASCADE      │   │
│  │ full_name (TEXT)                                          │   │
│  │ avatar_url (TEXT)                                         │   │
│  │ created_at (TIMESTAMPTZ)                                  │   │
│  │ updated_at (TIMESTAMPTZ)                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N CASCADE
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       company_members                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ id (UUID) PK                                              │   │
│  │ company_id (UUID) FK → companies(id) ON DELETE CASCADE    │   │
│  │ user_id (UUID) FK → profiles(id) ON DELETE CASCADE        │   │
│  │ role (TEXT) CHECK(role IN ('owner','admin','member'))    │   │
│  │ invited_by (UUID) FK → profiles(id) ON DELETE SET NULL    │   │
│  │ created_at (TIMESTAMPTZ)                                  │   │
│  │ updated_at (TIMESTAMPTZ)                                  │   │
│  │ UNIQUE(company_id, user_id)                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ N:1 CASCADE
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          companies                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ id (UUID) PK                                              │   │
│  │ name (TEXT)                                               │   │
│  │ vat_id (TEXT) UNIQUE                                      │   │
│  │ email (TEXT)                                              │   │
│  │ phone (TEXT)                                              │   │
│  │ address_line1, address_line2 (TEXT)                       │   │
│  │ address_city, address_state (TEXT)                        │   │
│  │ address_postal_code, address_country_code (TEXT)          │   │
│  │ address_freeform (TEXT)                                   │   │
│  │ logo_url (TEXT)                                           │   │
│  │ created_at (TIMESTAMPTZ)                                  │   │
│  │ updated_at (TIMESTAMPTZ)                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### CASCADE Behaviors

| Parent Table | Child Table | FK Column | On Delete Behavior |
|-------------|-------------|-----------|-------------------|
| `auth.users` | `profiles` | `id` | CASCADE (profile deleted) |
| `profiles` | `company_members` | `user_id` | CASCADE (memberships deleted) |
| `companies` | `company_members` | `company_id` | CASCADE (memberships deleted) |
| `profiles` | `company_members` | `invited_by` | SET NULL (preserve membership) |

**Example Cascade Flow**:
```
DELETE FROM auth.users WHERE id = 'user-uuid'
  → Deletes profile (CASCADE)
    → Deletes all company_members records (CASCADE)
      → Companies remain (no cascade from members to companies)
```

---

## Storage Bucket Configuration

### Bucket: company-logos

**Configuration**:
- **Access**: Private (RLS enforced)
- **Allowed Types**: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`
- **Max Size**: 2MB per file
- **Path Convention**: `{company_id}/logo.{ext}`

**RLS Policies**:

```sql
-- Members can view company logos
CREATE POLICY company_logos_select_policy ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (
        SELECT company_id::text
        FROM company_members
        WHERE user_id = auth.uid()
    )
);

-- Owners/admins can upload logos
CREATE POLICY company_logos_insert_policy ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (
        SELECT company_id::text
        FROM company_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);
```

### Bucket: user-avatars

**Configuration**:
- **Access**: Private (RLS enforced)
- **Allowed Types**: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`
- **Max Size**: 1MB per file
- **Path Convention**: `{user_id}/avatar.{ext}`

**RLS Policies**:

```sql
-- Users can view own avatar and co-members' avatars
CREATE POLICY user_avatars_select_policy ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'user-avatars'
    AND (
        (storage.foldername(name))[1]::uuid = auth.uid()
        OR (storage.foldername(name))[1]::uuid IN (
            SELECT cm2.user_id
            FROM company_members cm1
            JOIN company_members cm2 ON cm1.company_id = cm2.company_id
            WHERE cm1.user_id = auth.uid()
        )
    )
);

-- Users can only upload their own avatar
CREATE POLICY user_avatars_insert_policy ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
);
```

### Signed URL Generation

**Frontend Usage**:

```typescript
import { supabase } from '@/core/config/supabaseClient';

async function getCompanyLogoUrl(logoPath: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from('company-logos')
        .createSignedUrl(logoPath, 3600); // 1 hour expiration

    if (error) throw error;
    return data.signedUrl;
}
```

**Best Practices**:
- Cache signed URLs to avoid regeneration
- Refresh URLs before expiration (1-hour default)
- Handle missing files gracefully (return placeholder)

---

## Troubleshooting

### Common Migration Errors

#### Error: "Relation already exists"

**Cause**: Migration not idempotent, trying to create existing table.

**Solution**:
```sql
-- Use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS table_name (...);

-- Or check existence first
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'my_table') THEN
        CREATE TABLE my_table (...);
    END IF;
END $$;
```

#### Error: "Duplicate key violates unique constraint"

**Cause**: Migration inserting data that already exists.

**Solution**:
```sql
-- Use ON CONFLICT
INSERT INTO table_name (id, name)
VALUES ('id', 'name')
ON CONFLICT (id) DO NOTHING;

-- Or UPDATE on conflict
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

#### Error: "Column does not exist"

**Cause**: Migration assumes column exists before it's created.

**Solution**: Check column existence before using it:
```sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'website_url'
    ) THEN
        -- Safe to use column
        UPDATE companies SET website_url = 'https://example.com';
    END IF;
END $$;
```

### RLS Debugging Tips

#### Enable RLS Logging

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- View policies
SELECT * FROM pg_policies WHERE tablename = 'companies';
```

#### Test Policies with Different Users

```typescript
// Create test client with specific user token
const { data: { session } } = await supabase.auth.getSession();
console.log('Current user:', session?.user.id);

// Try operation
const { data, error } = await supabase
    .from('companies')
    .select('*');

console.log('Results:', data?.length, 'rows');
console.log('Error:', error);
```

#### Bypass RLS for Testing

```sql
-- Use service role client (ONLY in tests/migrations!)
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  -- ⚠️ Never expose to client!
);
```

### Performance Optimization

#### Identify Slow Queries

```sql
-- Enable query timing
SET track_io_timing = ON;

-- Analyze query plan
EXPLAIN ANALYZE
SELECT c.*
FROM companies c
WHERE EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = c.id
    AND cm.user_id = 'user-uuid'
);
```

#### Add Missing Indexes

```sql
-- Check for missing indexes on foreign keys
SELECT
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = tc.table_name
    AND indexdef LIKE '%' || kcu.column_name || '%'
);
```

#### Optimize RLS Policies

```sql
-- ❌ Slow: Subquery in SELECT
SELECT * FROM companies
WHERE id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid());

-- ✅ Fast: EXISTS with early exit
SELECT * FROM companies
WHERE EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = companies.id
    AND user_id = auth.uid()
);
```

---

## Rollback Procedures

### Pre-Rollback Checklist

Before rolling back a migration, verify:

1. **Backup exists**: Recent database dump available
2. **Application compatibility**: Old code can run with reverted schema
3. **Data loss assessment**: Understand what data will be lost
4. **User impact**: Estimate downtime and data unavailability

### Step-by-Step Rollback

#### 1. Create Backup

```bash
# Backup production database
pg_dump $DATABASE_URL > backup_before_rollback_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

#### 2. Assess Changes

```sql
-- Review recent migrations
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;

-- Check what needs to be reverted
\d+ table_name  -- Describe table structure
```

#### 3. Write Rollback Script

```sql
-- Example: Rolling back table addition
BEGIN;

-- 1. Drop new table
DROP TABLE IF EXISTS new_table CASCADE;

-- 2. Remove new columns
ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;

-- 3. Drop new indexes
DROP INDEX IF EXISTS idx_new_index;

-- 4. Drop new policies
DROP POLICY IF EXISTS new_policy ON existing_table;

-- 5. Drop new functions
DROP FUNCTION IF EXISTS new_function();

-- 6. Drop new triggers
DROP TRIGGER IF EXISTS new_trigger ON existing_table;

COMMIT;
```

#### 4. Test Rollback Locally

```bash
# Apply rollback to local database
supabase db reset
supabase db push  # Apply all migrations up to point before problem

# Test application
npm run dev

# Verify functionality
```

#### 5. Apply to Production

```bash
# Execute rollback
psql $DATABASE_URL < rollback_script.sql

# Verify schema
psql $DATABASE_URL -c "\d+ table_name"

# Monitor application logs
# Watch for errors
```

### Rollback Script Templates

#### Template 1: Reverse Table Creation

```sql
BEGIN;

-- Drop table and all dependent objects
DROP TABLE IF EXISTS table_name CASCADE;

-- Note: CASCADE removes:
-- - Foreign keys referencing this table
-- - Triggers on this table
-- - Indexes on this table
-- - RLS policies on this table

COMMIT;
```

#### Template 2: Reverse RLS Changes

```sql
BEGIN;

-- Remove new policies
DROP POLICY IF EXISTS new_select_policy ON table_name;
DROP POLICY IF EXISTS new_insert_policy ON table_name;
DROP POLICY IF EXISTS new_update_policy ON table_name;
DROP POLICY IF EXISTS new_delete_policy ON table_name;

-- Restore old policies (if different)
CREATE POLICY old_select_policy ON table_name
FOR SELECT TO authenticated
USING (old_condition);

-- Disable RLS (if it was enabled by migration)
-- ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

COMMIT;
```

#### Template 3: Reverse Trigger Changes

```sql
BEGIN;

-- Remove new trigger
DROP TRIGGER IF EXISTS new_trigger ON table_name;

-- Remove new function
DROP FUNCTION IF EXISTS new_function();

-- Restore old trigger (if different)
CREATE OR REPLACE FUNCTION old_function()
RETURNS TRIGGER AS $$
BEGIN
    -- Old logic
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER old_trigger
BEFORE UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION old_function();

COMMIT;
```

### Data Backup Procedures

#### Creating Database Dumps

```bash
# Full database dump
pg_dump $DATABASE_URL > full_backup.sql

# Schema only (no data)
pg_dump --schema-only $DATABASE_URL > schema_backup.sql

# Data only (no schema)
pg_dump --data-only $DATABASE_URL > data_backup.sql

# Specific table
pg_dump --table=table_name $DATABASE_URL > table_backup.sql

# Compressed dump
pg_dump $DATABASE_URL | gzip > backup.sql.gz
```

#### Restoring from Backup

```bash
# Restore full database (⚠️ DROPS existing data!)
psql $DATABASE_URL < full_backup.sql

# Restore specific table
psql $DATABASE_URL < table_backup.sql

# Restore from compressed dump
gunzip -c backup.sql.gz | psql $DATABASE_URL
```

### When Rollback is Safe vs Risky

#### ✅ Safe to Rollback

- Adding new tables (no existing data to lose)
- Adding new columns (column can be dropped without data loss)
- Adding new indexes (indexes are metadata only)
- Adding new RLS policies (removing them restores previous access)
- Adding new functions/triggers (removing them restores previous behavior)

#### ⚠️ Risky to Rollback

- **Dropping columns**: Data in those columns is lost permanently
- **Modifying data types**: May cause data corruption or loss
- **Removing constraints**: May allow invalid data
- **Cascading deletes**: May have deleted referenced data
- **Trigger modifications**: May have skipped critical operations

#### ❌ Cannot Rollback Safely

- **Data migrations**: Transformed data cannot be un-transformed
- **Dropped tables**: Data is gone unless backup exists
- **CASCADE operations**: Related data already deleted
- **Production with active users**: Concurrent operations may be affected

### Emergency Rollback Procedure

If application is broken in production:

```bash
# 1. Immediate: Revert to previous application version
git checkout previous-stable-tag
npm run build
npm run tauri build

# 2. Restore database backup
psql $DATABASE_URL < last_known_good_backup.sql

# 3. Verify application functionality
curl https://your-app.com/health

# 4. Investigate root cause
# Check migration logs
# Review error messages
# Test migration in isolated environment

# 5. Plan fix
# Write corrected migration
# Test thoroughly before redeployment
```

---

## Summary Checklist

### Before Making Schema Changes

- [ ] Backup production database
- [ ] Write idempotent migration script
- [ ] Test migration locally multiple times
- [ ] Review migration in pull request
- [ ] Document expected changes and rollback procedure
- [ ] Verify application code compatibility

### After Applying Migration

- [ ] Verify schema matches expectations
- [ ] Run application tests
- [ ] Monitor error logs
- [ ] Verify RLS policies work correctly
- [ ] Check query performance
- [ ] Update documentation

### If Migration Fails

- [ ] Do NOT panic - backup exists
- [ ] Revert application to previous version
- [ ] Execute rollback script
- [ ] Restore from backup if necessary
- [ ] Investigate failure in isolated environment
- [ ] Write corrected migration

---

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/ddl-priv.html)
- [Supabase Migration Guide](https://supabase.com/docs/guides/database/migrations)
- [Project CLAUDE.md](/CLAUDE.md) - Development guidelines
- [Schema Manipulation Audit](/docs/schema-manipulation-audit.md) - Security audit
- [CI Schema Checks](/docs/ci-schema-checks.md) - Automated safety checks

---

**Document Version**: 1.0
**Last Updated**: 2025-10-29
**Maintained By**: Development Team
**Review Cycle**: Quarterly or after major schema changes
