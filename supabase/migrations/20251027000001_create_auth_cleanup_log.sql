-- Migration: Create auth_cleanup_log table for orphaned user cleanup audit trail
-- Created: 2025-10-27
-- Purpose: Track all orphan cleanup operations with comprehensive audit logging
--          for compliance (GDPR/CCPA) and operational monitoring

-- Ensure pgcrypto extension is available for UUID generation
create extension if not exists "pgcrypto";

-- Create enum type for cleanup reasons
DO $$ BEGIN
    CREATE TYPE cleanup_reason_enum AS ENUM (
        'orphaned_unverified',
        'orphaned_verified',
        'user_requested',
        'admin_action'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum type for cleanup status
DO $$ BEGIN
    CREATE TYPE cleanup_status_enum AS ENUM (
        'pending',
        'completed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create auth_cleanup_log table
create table if not exists public.auth_cleanup_log (
  -- Primary key
  id uuid primary key default gen_random_uuid(),

  -- User identification (both plain and hashed for privacy)
  email text not null,
  email_hash text not null,
  user_id uuid,

  -- Cleanup operation metadata
  cleanup_reason cleanup_reason_enum not null,
  cleanup_status cleanup_status_enum not null default 'pending',

  -- Verification code lifecycle timestamps
  verification_code_sent_at timestamptz,
  verification_code_validated_at timestamptz,

  -- Cleanup operation timestamps
  cleanup_initiated_at timestamptz not null default now(),
  cleanup_completed_at timestamptz,

  -- Error handling
  error_message text,
  error_code text,

  -- Tracing and audit
  correlation_id uuid not null,
  ip_address_hash text not null,
  user_agent text,

  -- Standard timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Constraints
  constraint check_cleanup_reason check (
    cleanup_reason in ('orphaned_unverified', 'orphaned_verified', 'user_requested', 'admin_action')
  ),
  constraint check_cleanup_status check (
    cleanup_status in ('pending', 'completed', 'failed')
  )
);

-- Add table comment
comment on table public.auth_cleanup_log is
  'Audit trail for orphaned auth user cleanup operations. ' ||
  'Records all cleanup requests with verification code lifecycle, ' ||
  'deletion outcomes, and error details for compliance and troubleshooting.';

-- Add column comments for clarity
comment on column public.auth_cleanup_log.email is
  'Plain text email address (for operational queries, must be hashed in logs)';

comment on column public.auth_cleanup_log.email_hash is
  'SHA-256 hash of email for privacy-preserving queries and compliance';

comment on column public.auth_cleanup_log.user_id is
  'Supabase auth.users.id if available (nullable before user lookup)';

comment on column public.auth_cleanup_log.cleanup_reason is
  'Classification: orphaned_unverified (Case 1.1), orphaned_verified (Case 1.2), user_requested, admin_action';

comment on column public.auth_cleanup_log.correlation_id is
  'UUID for tracing entire operation across edge functions and frontend';

comment on column public.auth_cleanup_log.ip_address_hash is
  'SHA-256 hash of requester IP address for abuse detection without storing PII';

-- Create indexes for efficient querying
create index if not exists idx_auth_cleanup_log_email_hash
  on public.auth_cleanup_log(email_hash);

create index if not exists idx_auth_cleanup_log_correlation_id
  on public.auth_cleanup_log(correlation_id);

create index if not exists idx_auth_cleanup_log_created_at
  on public.auth_cleanup_log(created_at desc);

create index if not exists idx_auth_cleanup_log_user_id
  on public.auth_cleanup_log(user_id)
  where user_id is not null;

create index if not exists idx_auth_cleanup_log_status
  on public.auth_cleanup_log(cleanup_status, created_at desc);

-- Enable Row Level Security
alter table public.auth_cleanup_log enable row level security;

-- Create RLS policy: Service role only (no user access)
create policy if not exists "service_role_only"
  on public.auth_cleanup_log
  for all
  using (auth.role() = 'service_role');

comment on policy "service_role_only" on public.auth_cleanup_log is
  'Only service role can access cleanup logs. Users cannot view audit trail for security.';

-- Create updated_at trigger function
create or replace function public.update_auth_cleanup_log_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach trigger to auth_cleanup_log table
drop trigger if exists set_auth_cleanup_log_updated_at on public.auth_cleanup_log;
create trigger set_auth_cleanup_log_updated_at
  before update on public.auth_cleanup_log
  for each row
  execute function public.update_auth_cleanup_log_updated_at();

comment on function public.update_auth_cleanup_log_updated_at() is
  'Automatically updates updated_at timestamp on auth_cleanup_log row modifications';
