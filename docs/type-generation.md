# Supabase Type Generation Workflow

This document describes the workflow for generating and maintaining TypeScript types from the Supabase PostgreSQL schema.

## Overview

The project uses the Supabase CLI to automatically generate TypeScript types that match the database schema. This ensures type safety across the entire application stack when working with Supabase data.

## Prerequisites

- Supabase CLI installed globally (`npm install -g supabase`)
- Access to the Supabase project (project ID: `wnohgxkujwnuoqtibsss`)
- Authenticated with Supabase CLI

## Type Generation Command

To generate types from the remote Supabase project:

```bash
npm run generate:types
```

This command:
1. Connects to the Supabase project using the project ID
2. Introspects the PostgreSQL schema
3. Generates TypeScript type definitions
4. Outputs to `src/shared/types/supabase.ts`

## When to Regenerate Types

Types must be regenerated after:

1. **Database Migrations**: After applying any SQL migration that:
   - Creates, alters, or drops tables
   - Adds, modifies, or removes columns
   - Changes column types or constraints
   - Modifies views or functions exposed through PostgREST

2. **Schema Changes**: After any direct schema modifications in Supabase Studio

3. **RLS Policy Changes**: While RLS policies don't affect types directly, if they change table accessibility, regenerate types to ensure consistency

## Workflow Steps

### 1. After Making Schema Changes

```bash
# 1. Apply your migration (if using migrations)
supabase db push

# 2. Generate updated types
npm run generate:types

# 3. Verify types compile
npm run typecheck

# 4. Commit the generated types
git add src/shared/types/supabase.ts
git commit -m "chore: regenerate Supabase types after schema migration"
```

### 2. Before Starting Development

If you've pulled changes that include schema updates:

```bash
# Check if types are out of sync
npm run generate:types

# If changes detected, commit them
git diff src/shared/types/supabase.ts
```

## Generated Type Structure

The generated `supabase.ts` file includes:

```typescript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: { /* column types */ }
        Insert: { /* insert payload types */ }
        Update: { /* update payload types */ }
        Relationships: []
      }
      profiles: { /* ... */ }
      company_members: { /* ... */ }
      // ... other tables
    }
    Views: { /* ... */ }
    Functions: { /* ... */ }
    Enums: { /* ... */ }
    CompositeTypes: { /* ... */ }
  }
}
```

## Using Generated Types

### In Frontend Queries (Supabase Client)

```typescript
import type { Database } from '@/shared/types/supabase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient<Database>(url, key);

// Type-safe queries
const { data } = await supabase
  .from('companies') // autocomplete available
  .select('*')
  .eq('id', companyId);

// data is typed as Database['public']['Tables']['companies']['Row'][]
```

### In Type Definitions

```typescript
import type { Database } from '@/shared/types/supabase';

// Extract specific table types
export type Company = Database['public']['Tables']['companies']['Row'];
export type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
export type CompanyUpdate = Database['public']['Tables']['companies']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type CompanyMember = Database['public']['Tables']['company_members']['Row'];
```

### In IPC Commands (Rust Backend)

While the generated types are TypeScript-specific, they serve as the source of truth for creating matching Rust types:

```rust
// src-tauri/src/db/types/schema.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyRecord {
    pub id: Uuid,
    pub name: String,
    pub vat_id: String,
    pub email: String,
    // ... match TypeScript types exactly
}
```

## Troubleshooting

### Error: "Project not found"

**Cause**: Supabase CLI cannot find the project with the specified ID.

**Solution**:
```bash
# Login to Supabase CLI
supabase login

# Link to the project
supabase link --project-ref wnohgxkujwnuoqtibsss
```

### Error: "Authentication required"

**Cause**: Not authenticated with Supabase CLI.

**Solution**:
```bash
supabase login
```

### Error: "Type generation timeout"

**Cause**: Network issues or large schema introspection.

**Solution**:
- Check internet connection
- Retry the command
- If persistent, contact Supabase support

### Types Don't Match Database

**Cause**: Types were not regenerated after schema change.

**Solution**:
```bash
# Force regeneration
npm run generate:types

# Verify with typecheck
npm run typecheck
```

### Generated File is Empty

**Cause**: No public schema tables or connection issue.

**Solution**:
- Verify database has tables in `public` schema
- Check Supabase project is accessible
- Ensure schema is published (not just in draft)

## CI/CD Integration

The project includes automated checks to prevent type drift:

1. **Type Drift Check**: CI job generates types and compares with committed version
2. **Type Compilation**: CI job runs `npm run typecheck` to ensure types compile
3. **PR Requirement**: Both checks must pass before merging

See `.github/workflows/type-drift-check.yml` for implementation details.

## Best Practices

1. **Commit Generated Types**: Always commit `src/shared/types/supabase.ts` to version control
2. **Regenerate After Migrations**: Make type generation part of your migration workflow
3. **Review Type Changes**: Review type diffs in PRs to catch unintended schema changes
4. **Use Type Imports**: Import from generated types, don't manually define database types
5. **Keep Types Fresh**: Run `npm run generate:types` regularly during active development

## Related Documentation

- [Supabase Type Generation Docs](https://supabase.com/docs/guides/api/generating-types)
- [Schema Management](./schema-management.md)
- [Database Migrations](./migrations.md)
- [RLS Policies](./rls-policies.md)

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-29 | 1.0 | Initial documentation for type generation workflow |
