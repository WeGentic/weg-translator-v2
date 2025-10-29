<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
  <node TEXT="Supabase Schemas Tool" POSITION="right">

    <!-- Project Overview -->
    <node TEXT="1. Project Overview" POSITION="right">
      <node TEXT="Goals">
        <node TEXT="Remove app schema manipulation capabilities"/>
        <node TEXT="Create SQL for companies, profiles, company_members"/>
        <node TEXT="Implement RLS policies and triggers"/>
        <node TEXT="Adapt application code for new tables"/>
      </node>
      <node TEXT="Tech Stack">
        <node TEXT="Tauri 2.8.5 Desktop App"/>
        <node TEXT="React 19.2 Frontend"/>
        <node TEXT="Rust 1.89 Backend"/>
        <node TEXT="Supabase (Auth, Postgres, Storage)"/>
      </node>
      <node TEXT="Timeline">
        <node TEXT="20-33 developer days"/>
        <node TEXT="9 implementation phases"/>
        <node TEXT="~90 sub-tasks, 400+ atomic actions"/>
      </node>
    </node>

    <!-- Key Requirements -->
    <node TEXT="2. Requirements (30 Total)" POSITION="right">
      <node TEXT="Database Schema (Req 1-3)">
        <node TEXT="Req 1: companies table">
          <node TEXT="id, name, vat_id, email, phone"/>
          <node TEXT="address_street, address_city, address_postal_code, address_country"/>
          <node TEXT="logo_url, created_at, updated_at"/>
        </node>
        <node TEXT="Req 2: profiles table">
          <node TEXT="Extends auth.users"/>
          <node TEXT="id (FK to auth.users), full_name, avatar_url"/>
          <node TEXT="created_at, updated_at"/>
        </node>
        <node TEXT="Req 3: company_members table">
          <node TEXT="Junction table for user-company relationships"/>
          <node TEXT="id, company_id, user_id, role, invited_by"/>
          <node TEXT="Unique constraint: (company_id, user_id)"/>
        </node>
      </node>

      <node TEXT="Triggers (Req 4-5)">
        <node TEXT="Req 4: Auto-create profiles on auth.users insert"/>
        <node TEXT="Req 5: Auto-update updated_at timestamps"/>
      </node>

      <node TEXT="RLS Policies (Req 6-8)">
        <node TEXT="Req 6: companies RLS (members can view, admins modify)"/>
        <node TEXT="Req 7: profiles RLS (users can view/modify own)"/>
        <node TEXT="Req 8: company_members RLS (role-based access)"/>
      </node>

      <node TEXT="Storage (Req 9-10, 18-19, 29)">
        <node TEXT="Req 9: company-logos bucket with RLS"/>
        <node TEXT="Req 10: user-avatars bucket with RLS"/>
        <node TEXT="Req 18: Upload companies.logo_url"/>
        <node TEXT="Req 19: Upload profiles.avatar_url"/>
        <node TEXT="Req 29: Signed URLs for secure file access"/>
      </node>

      <node TEXT="Application Updates (Req 11, 27-28)">
        <node TEXT="Req 11: Remove schema manipulation code"/>
        <node TEXT="Req 27: Auth orphan detection integration"/>
        <node TEXT="Req 28: Update registration/login flows"/>
      </node>

      <node TEXT="IPC Commands (Req 12-14)">
        <node TEXT="Req 12: Companies CRUD commands"/>
        <node TEXT="Req 13: Profiles CRUD commands"/>
        <node TEXT="Req 14: Company members CRUD commands"/>
      </node>

      <node TEXT="Type Definitions (Req 15-16)">
        <node TEXT="Req 15: Frontend TypeScript types"/>
        <node TEXT="Req 16: Backend Rust types"/>
        <node TEXT="Use Supabase CLI for auto-generation"/>
      </node>

      <node TEXT="Testing (Req 20-21, 26)">
        <node TEXT="Req 20: RLS policy tests"/>
        <node TEXT="Req 21: Trigger tests"/>
        <node TEXT="Req 26: End-to-end tests"/>
      </node>

      <node TEXT="Documentation (Req 22, 25)">
        <node TEXT="Req 22: Schema and RLS documentation"/>
        <node TEXT="Req 25: Developer schema management guide"/>
      </node>

      <node TEXT="Other (Req 23-24, 30)">
        <node TEXT="Req 23: Error handling for Supabase operations"/>
        <node TEXT="Req 24: Migration from current schema"/>
        <node TEXT="Req 30: CI/CD checks for schema manipulation"/>
      </node>
    </node>

    <!-- Design Components -->
    <node TEXT="3. Design Architecture" POSITION="right">
      <node TEXT="Database Layer">
        <node TEXT="PostgreSQL Tables">
          <node TEXT="companies (separate address columns)"/>
          <node TEXT="profiles (extends auth.users)"/>
          <node TEXT="company_members (junction with roles)"/>
        </node>
        <node TEXT="Constraints &amp; Indexes">
          <node TEXT="Foreign keys with ON DELETE CASCADE"/>
          <node TEXT="Unique: (company_id, user_id)"/>
          <node TEXT="Indexes: user_id, company_id"/>
        </node>
        <node TEXT="Triggers">
          <node TEXT="handle_new_user() - auto-create profile"/>
          <node TEXT="update_updated_at_column() - timestamp"/>
        </node>
        <node TEXT="RLS Policies">
          <node TEXT="Fail-closed security model"/>
          <node TEXT="auth.uid() based access control"/>
          <node TEXT="Role-based permissions"/>
        </node>
      </node>

      <node TEXT="Storage Layer">
        <node TEXT="company-logos Bucket">
          <node TEXT="RLS: company members can view"/>
          <node TEXT="RLS: company admins can upload/delete"/>
        </node>
        <node TEXT="user-avatars Bucket">
          <node TEXT="RLS: authenticated users can view"/>
          <node TEXT="RLS: users can upload/delete own avatar"/>
        </node>
        <node TEXT="Signed URLs">
          <node TEXT="60-second expiry for security"/>
          <node TEXT="Automatic regeneration in frontend"/>
        </node>
      </node>

      <node TEXT="Backend (Rust) Layer">
        <node TEXT="Supabase Client">
          <node TEXT="Initialization with env vars"/>
          <node TEXT="Session management"/>
        </node>
        <node TEXT="IPC Commands">
          <node TEXT="src-tauri/src/ipc/commands/companies.rs"/>
          <node TEXT="src-tauri/src/ipc/commands/profiles.rs"/>
          <node TEXT="src-tauri/src/ipc/commands/members.rs"/>
        </node>
        <node TEXT="Type Definitions">
          <node TEXT="Auto-generated from Supabase CLI"/>
          <node TEXT="Serde serialization for IPC"/>
        </node>
        <node TEXT="Error Handling">
          <node TEXT="IpcError enum with user messages"/>
          <node TEXT="Correlation IDs for tracing"/>
        </node>
      </node>

      <node TEXT="Frontend (React) Layer">
        <node TEXT="Type Definitions">
          <node TEXT="Auto-generated TypeScript from Supabase CLI"/>
          <node TEXT="src/lib/database.types.ts"/>
        </node>
        <node TEXT="Query Hooks">
          <node TEXT="src/hooks/useCompanies.ts"/>
          <node TEXT="src/hooks/useProfiles.ts"/>
          <node TEXT="src/hooks/useCompanyMembers.ts"/>
        </node>
        <node TEXT="Supabase Client">
          <node TEXT="src/lib/supabaseClient.ts"/>
          <node TEXT="Session persistence"/>
        </node>
        <node TEXT="UI Components">
          <node TEXT="Company management"/>
          <node TEXT="Profile settings"/>
          <node TEXT="Member invitations"/>
        </node>
      </node>

      <node TEXT="Integration Points">
        <node TEXT="Auth Provider">
          <node TEXT="Update orphan detection queries"/>
          <node TEXT="Query company_members instead of companies"/>
        </node>
        <node TEXT="Registration Flow">
          <node TEXT="Update Edge Function create-company-admin"/>
          <node TEXT="Insert into profiles and company_members"/>
        </node>
        <node TEXT="Login Flow">
          <node TEXT="Fetch user's companies via company_members"/>
          <node TEXT="Load profile data"/>
        </node>
      </node>
    </node>

    <!-- Implementation Phases -->
    <node TEXT="4. Implementation (9 Phases)" POSITION="right">
      <node TEXT="Phase 0: Setup (1-2 days)">
        <node TEXT="Task 0.1: Install Supabase CLI"/>
        <node TEXT="Task 0.2: Configure type generation workflow"/>
        <node TEXT="Task 0.3: Test type generation pipeline"/>
      </node>

      <node TEXT="Phase 1: Database Foundation (3-4 days)">
        <node TEXT="Task 1.1: Create migration directory structure"/>
        <node TEXT="Task 1.2: Create companies table"/>
        <node TEXT="Task 1.3: Create profiles table"/>
        <node TEXT="Task 1.4: Create company_members table"/>
        <node TEXT="Task 1.5: Create auto-profile trigger"/>
        <node TEXT="Task 1.6: Create updated_at triggers"/>
        <node TEXT="Task 1.7: Test migration idempotency"/>
      </node>

      <node TEXT="Phase 2: RLS Policies (3-4 days)">
        <node TEXT="Task 2.1: Enable RLS on all tables"/>
        <node TEXT="Task 2.2: Implement companies RLS policies"/>
        <node TEXT="Task 2.3: Implement profiles RLS policies"/>
        <node TEXT="Task 2.4: Implement company_members RLS policies"/>
      </node>

      <node TEXT="Phase 3: Storage Buckets (2-3 days)">
        <node TEXT="Task 3.1: Create company-logos bucket"/>
        <node TEXT="Task 3.2: Create user-avatars bucket"/>
        <node TEXT="Task 3.3: Implement RLS for company-logos"/>
        <node TEXT="Task 3.4: Implement RLS for user-avatars"/>
        <node TEXT="Task 3.5: Test storage permissions"/>
      </node>

      <node TEXT="Phase 4: Type Definitions (1-2 days)">
        <node TEXT="Task 4.1: Generate TypeScript types"/>
        <node TEXT="Task 4.2: Create Rust type definitions"/>
      </node>

      <node TEXT="Phase 5: Query Layer (2-3 days)">
        <node TEXT="Task 5.1: Create companies query helpers"/>
        <node TEXT="Task 5.2: Create profiles query helpers"/>
        <node TEXT="Task 5.3: Create company_members query helpers"/>
        <node TEXT="Task 5.4: Create storage upload helpers"/>
      </node>

      <node TEXT="Phase 6: Auth Integration (2-3 days)">
        <node TEXT="Task 6.1: Update AuthProvider orphan detection"/>
        <node TEXT="Task 6.2: Update login flow for profiles"/>
      </node>

      <node TEXT="Phase 7: Registration Flow (2-3 days)">
        <node TEXT="Task 7.1: Update create-company-admin Edge Function"/>
        <node TEXT="Task 7.2: Update frontend registration form"/>
        <node TEXT="Task 7.3: Test end-to-end registration"/>
      </node>

      <node TEXT="Phase 8: Testing (3-4 days)">
        <node TEXT="Task 8.1: RLS policy unit tests"/>
        <node TEXT="Task 8.2: Trigger unit tests"/>
        <node TEXT="Task 8.3: Performance tests (orphan detection, queries)"/>
        <node TEXT="Task 8.4: Integration tests (CRUD operations)"/>
        <node TEXT="Task 8.5: End-to-end tests (registration, login)"/>
      </node>

      <node TEXT="Phase 9: Documentation &amp; CI (2-3 days)">
        <node TEXT="Task 9.1: Schema documentation"/>
        <node TEXT="Task 9.2: Developer schema management guide"/>
        <node TEXT="Task 9.3: Security audit"/>
        <node TEXT="Task 9.4: CI workflow for schema checks"/>
      </node>
    </node>

    <!-- Key Decisions -->
    <node TEXT="5. Key Design Decisions" POSITION="right">
      <node TEXT="Address Storage">
        <node TEXT="Decision: Separate columns (NOT JSONB)"/>
        <node TEXT="Reason: Better query performance, indexability"/>
      </node>
      <node TEXT="Role Definition">
        <node TEXT="Decision: TEXT + CHECK constraint (NOT ENUM)"/>
        <node TEXT="Reason: More flexible, easier to extend"/>
      </node>
      <node TEXT="Type Generation">
        <node TEXT="Decision: Supabase CLI auto-generation"/>
        <node TEXT="Reason: Prevents drift, single source of truth"/>
      </node>
      <node TEXT="Profile Creation">
        <node TEXT="Decision: Database trigger (NOT app logic)"/>
        <node TEXT="Reason: Guaranteed, can't be forgotten"/>
      </node>
      <node TEXT="Retry Strategy">
        <node TEXT="Decision: Exponential backoff + jitter"/>
        <node TEXT="Reason: Reduces tail latency, prevents thundering herd"/>
      </node>
      <node TEXT="Security">
        <node TEXT="Decision: Fail-closed RLS policies"/>
        <node TEXT="Reason: Deny by default, explicit allow"/>
      </node>
    </node>

    <!-- Risk Mitigation -->
    <node TEXT="6. Risks &amp; Mitigation" POSITION="right">
      <node TEXT="Performance Risks">
        <node TEXT="Risk: RLS policy overhead">
          <node TEXT="Mitigation: Monitor p95/p99 latency"/>
          <node TEXT="Mitigation: Optimize with indexes"/>
        </node>
        <node TEXT="Risk: Storage bucket query latency">
          <node TEXT="Mitigation: 60s signed URL caching"/>
          <node TEXT="Mitigation: Lazy loading"/>
        </node>
      </node>
      <node TEXT="Security Risks">
        <node TEXT="Risk: SECURITY DEFINER privilege escalation">
          <node TEXT="Mitigation: Explicit search_path in triggers"/>
          <node TEXT="Mitigation: Security audit"/>
        </node>
        <node TEXT="Risk: Overly permissive RLS">
          <node TEXT="Mitigation: Comprehensive test suite"/>
          <node TEXT="Mitigation: Fail-closed policies"/>
        </node>
      </node>
      <node TEXT="Data Integrity Risks">
        <node TEXT="Risk: Orphaned data after deletes">
          <node TEXT="Mitigation: ON DELETE CASCADE"/>
          <node TEXT="Mitigation: Integration tests"/>
        </node>
        <node TEXT="Risk: Type drift">
          <node TEXT="Mitigation: Auto-generated types"/>
          <node TEXT="Mitigation: CI type validation"/>
        </node>
      </node>
      <node TEXT="Migration Risks">
        <node TEXT="Risk: Breaking existing auth">
          <node TEXT="Mitigation: Thorough testing"/>
          <node TEXT="Mitigation: Rollback plan"/>
        </node>
        <node TEXT="Risk: Data loss during migration">
          <node TEXT="Mitigation: Backup before migration"/>
          <node TEXT="Mitigation: Transaction safety"/>
        </node>
      </node>
    </node>

    <!-- Success Criteria -->
    <node TEXT="7. Success Criteria" POSITION="right">
      <node TEXT="Functional">
        <node TEXT="All 30 requirements implemented"/>
        <node TEXT="All CRUD operations working"/>
        <node TEXT="RLS policies enforce correct access"/>
        <node TEXT="Triggers function correctly"/>
        <node TEXT="No schema manipulation code in app"/>
      </node>
      <node TEXT="Performance">
        <node TEXT="Orphan detection: p95 &lt; 200ms, p99 &lt; 350ms"/>
        <node TEXT="CRUD operations: &lt; 100ms"/>
        <node TEXT="Storage queries: &lt; 150ms"/>
      </node>
      <node TEXT="Security">
        <node TEXT="RLS policies pass all tests"/>
        <node TEXT="No privilege escalation vulnerabilities"/>
        <node TEXT="Storage files properly isolated"/>
      </node>
      <node TEXT="Quality">
        <node TEXT="100% requirement coverage"/>
        <node TEXT="All tests passing"/>
        <node TEXT="Documentation complete"/>
        <node TEXT="CI/CD checks passing"/>
      </node>
    </node>

    <!-- Next Steps -->
    <node TEXT="8. Next Actions" POSITION="right">
      <node TEXT="1. Ask user for AUTO or FEEDBACK mode"/>
      <node TEXT="2. Read TaskList.md and create TODO"/>
      <node TEXT="3. Execute Phase 0: Setup">
        <node TEXT="Install Supabase CLI"/>
        <node TEXT="Configure type generation"/>
      </node>
      <node TEXT="4. Execute Phase 1: Database Foundation">
        <node TEXT="Create migration structure"/>
        <node TEXT="Create tables"/>
        <node TEXT="Create triggers"/>
      </node>
      <node TEXT="5. Continue through all 9 phases sequentially"/>
      <node TEXT="6. Validate and test at each phase"/>
      <node TEXT="7. Document learnings and adjustments"/>
    </node>

  </node>
</map>
