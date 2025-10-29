# CI Schema Safety Checks Documentation

**Last Updated**: 2025-10-29
**Workflow File**: `.github/workflows/schema-safety-check.yml`
**Status**: Active and Required for PR Merge

---

## Overview

The **Schema Safety Check** is an automated CI/CD workflow that prevents schema manipulation code from being merged into the codebase. This workflow enforces the project's **developer-managed schema** policy by scanning for prohibited patterns in pull requests.

### Purpose

1. **Prevent security vulnerabilities**: Block DDL statements that could be exploited
2. **Enforce architectural compliance**: Ensure schemas managed through migrations only
3. **Catch mistakes early**: Detect prohibited patterns before code review
4. **Maintain audit trail**: Document compliance through automated checks

### When It Runs

- ✅ On all pull requests to `main` or `develop` branches
- ✅ On push to `main` or `develop` branches
- ✅ When changes are made to:
  - TypeScript files (`src/**/*.ts`, `src/**/*.tsx`)
  - Rust files (`src-tauri/src/**/*.rs`)
  - SQL migration files (`supabase/**/*.sql`)

---

## Checks Performed

### 1. DDL Keyword Scan - TypeScript Files

**What it does**: Searches all TypeScript and TSX files for Data Definition Language (DDL) keywords.

**Keywords Detected**:
- `CREATE TABLE`
- `ALTER TABLE`
- `DROP TABLE`
- `CREATE SCHEMA`
- `DROP SCHEMA`
- `TRUNCATE TABLE`

**Example Violation**:
```typescript
❌ // This will FAIL the check
const query = `CREATE TABLE users (id UUID PRIMARY KEY)`;
await supabase.rpc('execute_sql', { query });
```

**How to Fix**: Remove DDL from application code and create a SQL migration instead.

### 2. DDL Keyword Scan - Rust Application Files

**What it does**: Searches all Rust source files (excluding migrations and tests) for DDL keywords.

**Exclusions**:
- `src-tauri/migrations/` (allowed to contain DDL)
- `src-tauri/target/` (build artifacts)
- Test files containing `#[cfg(test)]`

**Example Violation**:
```rust
❌ // This will FAIL the check
let query = format!("DROP TABLE {}", table_name);
sqlx::query(&query).execute(&pool).await?;
```

**How to Fix**: Use approved patterns (see below).

### 3. Raw SQL Execution Check

**What it does**: Detects usage of raw SQL execution functions that bypass compile-time validation.

**Functions Detected**:
- `query_raw`
- `execute_raw`
- `sql::raw`

**Example Violation**:
```rust
❌ // This will FAIL the check
let result = sqlx::query_raw(&user_provided_query)
    .fetch_all(&pool)
    .await?;
```

**How to Fix**: Use SQLx macros (`sqlx::query!`, `sqlx::query_as!`) or Supabase client methods.

### 4. String Concatenation in Queries Check

**What it does**: Detects potential SQL injection via string formatting in queries.

**Patterns Detected**:
- `format!()` near SQL keywords
- `concat!()` near SQL keywords
- String interpolation in SQL statements

**Example Violation**:
```rust
❌ // This will FAIL the check
let query = format!("SELECT * FROM users WHERE id = '{}'", user_id);
sqlx::query(&query).fetch_all(&pool).await?;
```

**How to Fix**: Use parameterized queries with placeholders.

### 5. Supabase Client Usage Validation

**What it does**: Checks for potential misuse of Supabase RPC functions with DDL operations.

**Patterns Detected**:
- `supabase.rpc()` calls containing DDL keywords
- RPC function names suggesting schema manipulation

**Example Violation**:
```typescript
❌ // This will FAIL the check
await supabase.rpc('create_dynamic_table', {
    table_name: userInput,
    columns: dynamicColumns
});
```

**How to Fix**: Remove RPC functions that perform DDL; use migrations instead.

### 6. Migration File Validation

**What it does**: Validates that SQL migration files follow idempotency patterns.

**Checks**:
- Presence of `IF NOT EXISTS` clauses
- Use of `CREATE OR REPLACE FUNCTION`
- Proper `DROP IF EXISTS` patterns

**Example Warning**:
```sql
⚠️  // This will generate a warning (not failure)
CREATE TABLE users (...);  -- Missing IF NOT EXISTS

✅ // This is correct
CREATE TABLE IF NOT EXISTS users (...);
```

**Note**: This check generates warnings, not failures, as migrations may have valid reasons for non-idempotent patterns.

---

## Approved vs Prohibited Code

### ✅ Approved Patterns

#### Pattern 1: Supabase Client with Type Safety

```typescript
// ✅ APPROVED - Uses Supabase client methods
const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId);

const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: newName })
    .eq('id', userId);
```

#### Pattern 2: SQLx Macros with Compile-Time Validation

```rust
// ✅ APPROVED - Uses SQLx macro with placeholders
let project = sqlx::query_as!(
    ProjectRecord,
    r#"SELECT id, name FROM projects WHERE id = ?"#,
    project_id
)
.fetch_one(&pool)
.await?;

// ✅ APPROVED - Parameterized insert
sqlx::query!(
    r#"INSERT INTO projects (id, name) VALUES (?, ?)"#,
    id,
    name
)
.execute(&pool)
.await?;
```

#### Pattern 3: Type-Safe IPC Commands

```rust
// ✅ APPROVED - Type-safe Tauri command
#[tauri::command]
async fn get_company(company_id: String) -> Result<Option<CompanyDto>, IpcError> {
    // Uses Supabase client internally (no DDL)
    let company = supabase_client
        .from("companies")
        .select("*")
        .eq("id", &company_id)
        .single()
        .await?;

    Ok(company)
}
```

#### Pattern 4: SQL Migrations (Correct Location)

```sql
-- ✅ APPROVED - Migration file in supabase/migrations/
-- File: supabase/migrations/20251029_add_website_column.sql

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'website_url'
    ) THEN
        ALTER TABLE public.companies ADD COLUMN website_url TEXT;
    END IF;
END $$;

COMMIT;
```

### ❌ Prohibited Patterns

#### Pattern 1: DDL in Application Code

```typescript
❌ // PROHIBITED - DDL in TypeScript
const createTable = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL
    )
`;
await supabase.rpc('execute_ddl', { query: createTable });
```

#### Pattern 2: Raw SQL Execution

```rust
❌ // PROHIBITED - Raw SQL without validation
let query = user_provided_sql;
sqlx::query(&query).execute(&pool).await?;
```

#### Pattern 3: SQL Injection via String Concatenation

```typescript
❌ // PROHIBITED - SQL injection vulnerability
const userId = userInput;
const query = `SELECT * FROM users WHERE id = '${userId}'`;
await executeQuery(query);
```

```rust
❌ // PROHIBITED - String formatting in SQL
let table_name = get_table_from_user();
let query = format!("DROP TABLE {}", table_name);
sqlx::query(&query).execute(&pool).await?;
```

#### Pattern 4: Dynamic Schema Modification

```typescript
❌ // PROHIBITED - Runtime schema changes
async function addColumnDynamically(tableName: string, columnName: string) {
    await supabase.rpc('alter_table', {
        table: tableName,
        action: 'ADD COLUMN',
        column: columnName
    });
}
```

---

## How to Fix Violations

### Step 1: Identify the Violation

When the workflow fails, check the GitHub Actions log:

```
❌ FAILURE: DDL keywords found in TypeScript files!

src/modules/database/schema.ts:45:    const query = `CREATE TABLE users (...)`
src/modules/database/schema.ts:78:    await executeSQL(`ALTER TABLE ...`)

Schema changes MUST be performed through SQL migrations in supabase/migrations/
Application code MUST NOT contain DDL statements.
```

### Step 2: Remove Prohibited Code

Delete or refactor the code that triggered the violation:

```typescript
// ❌ Before (violates policy)
async function createUserTable() {
    const sql = `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL
    )`;
    await supabase.rpc('execute', { sql });
}

// ✅ After (violation removed)
// Table creation moved to migration file
// Application only uses the table, doesn't create it
async function getUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*');
    return data;
}
```

### Step 3: Create SQL Migration

If you need to make schema changes, create a migration file:

```bash
# Create new migration
supabase migration new add_users_table

# Edit the generated file
# File: supabase/migrations/20251029123456_add_users_table.sql
```

```sql
-- Migration: Add users table
BEGIN;

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMIT;
```

### Step 4: Test Locally

```bash
# Reset database to clean state
supabase db reset

# Apply migration
supabase db push

# Test multiple times for idempotency
supabase db reset
supabase db push
supabase db push  # Should succeed without errors

# Verify application works
npm run dev
```

### Step 5: Push Changes and Rerun CI

```bash
git add supabase/migrations/20251029123456_add_users_table.sql
git add src/  # With prohibited code removed
git commit -m "refactor: move schema changes to migration"
git push
```

The CI workflow will rerun automatically and should now pass.

---

## Common Scenarios

### Scenario 1: False Positive - Test Code

**Problem**: Test code legitimately contains DDL for test database setup.

**Solution**: Ensure test files are properly excluded:

```rust
// Test file should be in tests/ directory or use #[cfg(test)]
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_with_temp_table() {
        // DDL in tests is allowed
        let setup = "CREATE TEMPORARY TABLE test_data (...)";
        // ...
    }
}
```

**Note**: The workflow automatically excludes files matching `test` in grep results.

### Scenario 2: Migration Idempotency Warning

**Problem**: New migration generates idempotency warning but is intentionally non-idempotent.

**Solution**: Document why the migration cannot be idempotent:

```sql
-- Migration: Data backfill (not idempotent by design)
-- WARNING: This migration can only be run once
-- Reason: Performs one-time data transformation

BEGIN;

-- This UPDATE is not idempotent - it modifies data permanently
UPDATE companies
SET normalized_name = LOWER(TRIM(name))
WHERE normalized_name IS NULL;

COMMIT;
```

**Note**: Warnings do not fail the CI check, they're informational only.

### Scenario 3: Legitimate RPC Function

**Problem**: You have a legitimate RPC function that doesn't perform DDL, but the name contains "create".

**Solution**: Rename the function to avoid confusion:

```sql
-- ❌ Triggers warning (even if safe)
CREATE FUNCTION create_invoice(...) RETURNS ...;

-- ✅ Clear and avoids warning
CREATE FUNCTION generate_invoice(...) RETURNS ...;
```

---

## Branch Protection Configuration

To enforce the Schema Safety Check, configure branch protection rules:

### GitHub Settings

1. Navigate to: **Settings → Branches → Branch Protection Rules**
2. Select branch: `main` (or `develop`)
3. Enable: ✅ **Require status checks to pass before merging**
4. Select required check: ✅ **Schema Safety Check / schema-safety-check**
5. Enable: ✅ **Require branches to be up to date before merging**
6. Save changes

### Required Workflow Status

The workflow must complete successfully with all checks passing:

- ✅ DDL Keyword Scan - TypeScript Files
- ✅ DDL Keyword Scan - Rust Application Files
- ✅ Raw SQL Execution Check - Rust
- ✅ String Concatenation in Queries Check
- ✅ Supabase Client Usage Validation
- ✅ Migration File Validation (warnings only)

---

## Troubleshooting

### Workflow Not Running

**Symptoms**: PR created but workflow doesn't trigger.

**Possible Causes**:
1. Changes don't match path filters
2. Workflow file has syntax errors
3. GitHub Actions disabled for repository

**Solutions**:
```bash
# Check workflow syntax
yamllint .github/workflows/schema-safety-check.yml

# Manually trigger workflow
# Go to Actions tab → Schema Safety Check → Run workflow

# Verify path filters match your changes
git diff --name-only origin/main
```

### False Positives in Comments

**Symptoms**: Workflow fails on commented-out code or strings.

**Workaround**: Grep matches comments; remove or rephrase:

```typescript
// ❌ This comment triggers the check
// TODO: We need to CREATE TABLE for users

// ✅ Rephrased to avoid trigger
// TODO: We need a migration to add users table
```

### Workflow Timeout

**Symptoms**: Workflow runs for >10 minutes and times out.

**Possible Causes**: Large codebase, slow grep operations.

**Solutions**:
```yaml
# Add timeout to workflow (in .github/workflows/schema-safety-check.yml)
jobs:
  schema-safety-check:
    timeout-minutes: 5  # Add this line
    runs-on: ubuntu-latest
    # ...
```

---

## Maintenance

### Updating the Workflow

When modifying the workflow file:

1. **Test changes locally** using `act` (GitHub Actions local runner)
2. **Create a test PR** to verify behavior
3. **Document changes** in this file and commit message
4. **Update version** if using workflow versioning

### Adding New Checks

To add a new check:

```yaml
- name: Your New Check
  id: your-check-id
  run: |
    echo "🔍 Running your new check..."

    # Your check logic here
    if grep -rn "PROHIBITED_PATTERN" src/ --include="*.ts"; then
      echo "❌ FAILURE: Prohibited pattern found!"
      echo "See: docs/ci-schema-checks.md#your-check"
      exit 1
    else
      echo "✅ Check passed"
    fi
```

### Excluding Files/Directories

To exclude specific paths from checks:

```bash
# Exclude specific directory
grep -rn "PATTERN" src/ --include="*.ts" --exclude-dir="vendor"

# Exclude specific file pattern
grep -rn "PATTERN" src/ --include="*.ts" --exclude="*.generated.ts"

# Multiple exclusions
grep -rn "PATTERN" src/ \
  --include="*.ts" \
  --exclude-dir="vendor" \
  --exclude-dir="node_modules" \
  --exclude="*.generated.ts"
```

---

## Related Documentation

- [Schema Management Guide](./schema-management.md) - Comprehensive schema management documentation
- [Schema Manipulation Audit](./schema-manipulation-audit.md) - Security audit report
- [CLAUDE.md](../CLAUDE.md) - Project development guidelines
- [Supabase Migrations](https://supabase.com/docs/guides/database/migrations) - Official Supabase migration docs

---

## Quick Reference

### Workflow File Location
```
.github/workflows/schema-safety-check.yml
```

### Manual Trigger (GitHub UI)
```
Actions → Schema Safety Check → Run workflow → Run workflow
```

### Local Testing
```bash
# Install act (GitHub Actions local runner)
brew install act  # macOS
# or: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act pull_request -W .github/workflows/schema-safety-check.yml
```

### Common Exit Codes
- `0` - All checks passed ✅
- `1` - Check failed, prohibited pattern found ❌
- `2` - Workflow configuration error ⚠️

---

**Document Version**: 1.0
**Last Updated**: 2025-10-29
**Maintained By**: Development Team
**Review Cycle**: After any workflow changes or quarterly
