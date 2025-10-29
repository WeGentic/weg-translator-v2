-- Migration: Create retention policy for auth_cleanup_log
-- Created: 2025-10-27
-- Purpose: Automatically delete auth_cleanup_log records older than 12 months
--          for compliance with data retention policies (NFR-7: 90 days min, 1 year max)

-- Ensure pg_cron extension is available (requires superuser in production)
-- Note: On Supabase, pg_cron is pre-enabled on Pro plan and above
-- If this fails locally, you can skip and manually run cleanup
create extension if not exists pg_cron;

-- Create function to cleanup old audit logs
create or replace function public.cleanup_old_auth_cleanup_logs()
returns table (
  records_deleted bigint,
  retention_months int,
  execution_timestamp timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count bigint;
  v_retention_months constant int := 12;
  v_cutoff_date timestamptz;
begin
  -- Calculate cutoff date (12 months ago)
  v_cutoff_date := now() - interval '12 months';

  -- Log start of cleanup operation
  raise notice 'Starting auth_cleanup_log retention policy execution at %', now();
  raise notice 'Deleting records older than % (cutoff: %)', v_retention_months || ' months', v_cutoff_date;

  -- Delete records older than retention period
  delete from public.auth_cleanup_log
  where created_at < v_cutoff_date;

  -- Get count of deleted records
  get diagnostics v_deleted_count = row_count;

  -- Log completion
  raise notice 'Retention policy completed: % records deleted', v_deleted_count;

  -- Return summary
  return query
  select
    v_deleted_count as records_deleted,
    v_retention_months as retention_months,
    now() as execution_timestamp;
end;
$$;

comment on function public.cleanup_old_auth_cleanup_logs() is
  'Deletes auth_cleanup_log records older than 12 months. ' ||
  'Scheduled to run daily via pg_cron. Returns count of deleted records.';

-- Schedule cron job to run daily at 2 AM UTC
-- Note: pg_cron uses UTC timezone by default
-- Cron expression: '0 2 * * *' = "At 02:00 on every day"
select cron.schedule(
  'cleanup-old-auth-cleanup-logs',           -- Job name
  '0 2 * * *',                               -- Cron expression: daily at 2 AM UTC
  $$select public.cleanup_old_auth_cleanup_logs()$$  -- SQL command
);

comment on function cron.schedule(text, text, text) is
  'Scheduled job: cleanup-old-auth-cleanup-logs runs daily at 2 AM UTC to enforce 12-month retention policy';

-- Create a helper function to view retention policy status
create or replace function public.get_auth_cleanup_log_retention_stats()
returns table (
  total_records bigint,
  records_within_retention bigint,
  records_beyond_retention bigint,
  oldest_record_age_days int,
  retention_policy_months int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retention_months constant int := 12;
begin
  return query
  select
    count(*)::bigint as total_records,
    count(*) filter (where created_at >= now() - interval '12 months')::bigint as records_within_retention,
    count(*) filter (where created_at < now() - interval '12 months')::bigint as records_beyond_retention,
    extract(day from now() - min(created_at))::int as oldest_record_age_days,
    v_retention_months as retention_policy_months
  from public.auth_cleanup_log;
end;
$$;

comment on function public.get_auth_cleanup_log_retention_stats() is
  'Returns statistics about auth_cleanup_log retention compliance. ' ||
  'Useful for monitoring and manual verification of retention policy enforcement.';

-- Grant execute permissions to service role
grant execute on function public.cleanup_old_auth_cleanup_logs() to service_role;
grant execute on function public.get_auth_cleanup_log_retention_stats() to service_role;
