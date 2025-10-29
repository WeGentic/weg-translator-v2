# Supabase Schemas Tool - User Input Analysis

**Project Name**: supabase-schemas-tool
**Date**: 2025-10-29
**Mode**: Full Workflow (Plan + Code Generation)

---

## Original User Input

### Primary Objectives

1. **Remove Schema Manipulation Capabilities**
   - Remove any app capability of manipulating Supabase Postgres schemas
   - Schemas will be managed independently by developers (not through the app)

2. **Create SQL Schema Implementation**
   - Implement three core tables: `companies`, `profiles`, `company_members`
   - Include RLS (Row Level Security) policies
   - Include triggers (primarily for `updated_at` fields)

3. **Adapt Application Code**
   - Modify existing code to write/read to/from the new tables
   - Ensure proper integration with Supabase client

---

## Schema Specifications

### 1. **companies** table
Organization/business entities:
- `id`: uuid (primary key, default: gen_random_uuid())
- `name`: text (not null)
- `vat_id`: text (unique, not null)
- `email`: text (not null)
- `phone`: text
- `address`: jsonb OR separate columns
  - Option A: `address` jsonb: `{street, city, postal_code, country}`
  - Option B: `address_street`, `address_city`, `address_postal_code`, `address_country`
- `logo_url`: text (reference to Supabase Storage bucket)
- `created_at`: timestamptz (default: now())
- `updated_at`: timestamptz (default: now())

### 2. **profiles** table
Extends Supabase's `auth.users` with additional user data:
- `id`: uuid (primary key, references auth.users.id on delete cascade)
- `full_name`: text
- `avatar_url`: text
- `created_at`: timestamptz (default: now())
- `updated_at`: timestamptz (default: now())

### 3. **company_members** table
Junction table managing user-company relationships and roles:
- `id`: uuid (primary key, default: gen_random_uuid())
- `company_id`: uuid (not null, references companies.id on delete cascade)
- `user_id`: uuid (not null, references profiles.id on delete cascade)
- `role`: text (not null, check constraint or enum)
- `invited_by`: uuid (references profiles.id, nullable for first admin)
- `created_at`: timestamptz (default: now())
- `updated_at`: timestamptz (default: now())

**Constraints**:
- Unique constraint: (company_id, user_id)
- Indexes: (user_id), (company_id)

---

## Key Analysis Points

### A. Technical Context

**Application Stack**:
- Tauri 2.8.5 desktop application
- React 19.2 frontend
- Rust 1.89 backend
- Supabase (auth, cloud database, storage)
- SQLite for local data (separate from Supabase Postgres)

**Target Database**: Supabase Postgres (PostgreSQL cloud instance)

### B. Key Objectives Breakdown

1. **Security & Access Control**
   - Implement RLS policies to control data access at row level
   - Ensure users can only access companies they're members of
   - Handle different role-based permissions (owner, admin, member, etc.)

2. **Data Integrity**
   - Cascade deletes properly configured
   - Foreign key constraints properly set
   - Unique constraints to prevent duplicate memberships
   - Triggers for automatic timestamp updates

3. **Storage References**
   - `logo_url` references Supabase Storage bucket
   - `avatar_url` references Supabase Storage bucket
   - Need proper storage bucket configuration and policies

4. **Authentication Integration**
   - Profiles extend `auth.users`
   - Must handle user creation flow (auth signup → profile creation)
   - Likely need trigger or function to auto-create profile on user signup

### C. Technical Constraints

1. **Schema Management**
   - SQL scripts must be idempotent (can run multiple times safely)
   - Should use migrations pattern
   - Must be maintainable by developers independently

2. **Application Integration**
   - Remove any existing schema manipulation code
   - Create clean CRUD operations for:
     - Company management
     - Profile management
     - Company membership management (invites, role changes, removal)
   - Type-safe operations (TypeScript on frontend, Rust types on backend)

3. **Performance Considerations**
   - Proper indexing on foreign keys
   - Efficient queries for common operations (get user's companies, get company members)
   - Optimize for read-heavy operations

### D. Design Decisions Required

1. **Address Storage**: JSONB vs Separate Columns
   - **JSONB Pros**: Flexible, can add fields without migration, stores as single value
   - **JSONB Cons**: Less queryable, harder to index specific address components
   - **Separate Columns Pros**: Directly queryable, can index, clearer schema
   - **Separate Columns Cons**: Less flexible, requires migration to add fields
   - **Recommendation**: JSONB for flexibility, add GIN index if needed

2. **Role Definition**: Enum vs Check Constraint
   - **Enum Pros**: Type safety, clear domain
   - **Enum Cons**: Requires migration to add roles
   - **Check Constraint Pros**: Easier to modify
   - **Recommendation**: Use enum type for clarity and type safety

3. **Profile Creation**: Trigger vs Application Logic
   - **Trigger Pros**: Automatic, can't be forgotten, database-level guarantee
   - **Trigger Cons**: Less visible, harder to debug
   - **Recommendation**: Use database trigger for automatic profile creation on auth.users insert

### E. Implementation Scope

#### SQL Artifacts (Priority 1)
- [ ] Table creation scripts with proper constraints
- [ ] Foreign key relationships with cascade rules
- [ ] Indexes for performance
- [ ] Triggers for `updated_at` fields
- [ ] Trigger for auto-creating profiles from auth.users
- [ ] RLS policies for each table
- [ ] Initial migration file structure

#### Backend Changes (Priority 2)
- [ ] Remove schema manipulation code (if exists)
- [ ] Supabase client configuration and types
- [ ] IPC commands for companies CRUD
- [ ] IPC commands for profiles CRUD
- [ ] IPC commands for company_members CRUD
- [ ] Rust type definitions matching schema
- [ ] Error handling for Supabase operations

#### Frontend Changes (Priority 3)
- [ ] Remove schema manipulation UI (if exists)
- [ ] TypeScript types for schema entities
- [ ] Hooks for company operations
- [ ] Hooks for profile operations
- [ ] Hooks for membership operations
- [ ] UI components for company management
- [ ] UI components for member invitations

#### Documentation (Priority 4)
- [ ] Schema documentation
- [ ] RLS policy documentation
- [ ] Developer guide for schema management
- [ ] API documentation for new operations

### F. Risk Areas

1. **Breaking Auth Flow**
   - Profile table extends auth.users
   - Must ensure profile creation doesn't break existing auth
   - Need careful testing of signup/login flows

2. **RLS Policy Complexity**
   - Policies must be neither too restrictive nor too permissive
   - Complex policies can impact performance
   - Must test all access scenarios

3. **Data Orphaning**
   - Improper cascade rules could leave orphaned data
   - Or too aggressive cascades could delete needed data
   - Need careful consideration of delete behavior

4. **Performance**
   - Missing indexes could cause slow queries
   - Complex RLS policies can slow down queries
   - Need proper indexing strategy

### G. Codebase Analysis Requirements

To proceed effectively, need to analyze:

1. **Current Supabase Integration**
   - How is Supabase client initialized?
   - Where are Supabase types defined?
   - Current query patterns and error handling

2. **Existing Auth Implementation**
   - Current user management code
   - Auth flow (signup/login/logout)
   - User state management

3. **Schema Manipulation Code**
   - Any existing code that manipulates schemas
   - Where it's located (frontend/backend)
   - Dependencies on this functionality

4. **Pattern Conventions**
   - Naming conventions for IPC commands
   - Error handling patterns
   - Type definition locations
   - Testing patterns

---

## Success Criteria

1. **SQL Scripts**
   - ✅ All tables created with correct schema
   - ✅ All constraints and indexes in place
   - ✅ RLS policies enforce proper access control
   - ✅ Triggers function correctly
   - ✅ Scripts are idempotent

2. **Application Code**
   - ✅ Schema manipulation code removed
   - ✅ CRUD operations work for all entities
   - ✅ Type safety maintained throughout
   - ✅ Error handling is robust
   - ✅ Integration with existing auth works

3. **Testing**
   - ✅ RLS policies tested with different user scenarios
   - ✅ Cascade deletes behave correctly
   - ✅ All CRUD operations tested
   - ✅ No breaking changes to existing functionality

4. **Documentation**
   - ✅ Clear developer guide for schema management
   - ✅ API documentation for new operations
   - ✅ Schema and policy documentation

---

## Next Steps

1. ✅ Create project structure - DONE
2. ✅ Store user input analysis - DONE
3. ⏭️ Perform codebase analysis (3 parallel agents)
4. ⏭️ Gather detailed requirements
5. ⏭️ Create design document
6. ⏭️ Validate knowledge and fill gaps
7. ⏭️ Generate task list
8. ⏭️ Create mindmap
9. ⏭️ Execute implementation

---

**End of User Input Analysis**
