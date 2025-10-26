-- Supabase provisioning script for the Weg Translator registration flow.
-- Creates tenancy tables, constraints, RLS policies, and a helper role intended
-- for the upcoming register_organization Edge Function.

-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Companies hold organization-wide metadata and are scoped by the primary admin.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_admin_uuid uuid not null references auth.users(id) on delete restrict,
  name text not null,
  email text not null,
  phone text not null,
  tax_id text not null,
  tax_country_code text check (char_length(tax_country_code) = 2),
  address_freeform text not null,
  address_line1 text,
  address_line2 text,
  address_city text,
  address_state text,
  address_postal_code text,
  address_country_code text check (char_length(address_country_code) = 2),
  account_type text,
  subscription_plan text,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  account_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is
  'Registered organizations mapped to Supabase auth users. owner_admin_uuid references auth.uid().';

-- Company admins store the join between auth users and their organizations.
create table if not exists public.company_admins (
  admin_uuid uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  admin_email text not null,
  phone text,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  account_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_admins is
  'Organization administrators keyed by auth.uid(); mirrors Supabase auth.users.';

-- Indexes & constraints -----------------------------------------------------

create unique index if not exists companies_owner_unique
  on public.companies(owner_admin_uuid);

create unique index if not exists companies_email_unique
  on public.companies(lower(email));

create unique index if not exists companies_tax_id_country_unique
  on public.companies(lower(tax_id), coalesce(tax_country_code, ''));

create index if not exists companies_country_code_idx
  on public.companies(coalesce(address_country_code, tax_country_code));

create unique index if not exists company_admins_email_unique
  on public.company_admins(lower(admin_email));

create index if not exists company_admins_company_idx
  on public.company_admins(company_id);

-- Row level security --------------------------------------------------------

alter table public.companies enable row level security;
alter table public.company_admins enable row level security;

create policy if not exists "company_admins_manage_own_company"
  on public.companies
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.company_admins ca
      where ca.company_id = companies.id
        and ca.admin_uuid = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.company_admins ca
      where ca.company_id = companies.id
        and ca.admin_uuid = auth.uid()
    )
  );

comment on policy "company_admins_manage_own_company" on public.companies is
  'Authenticated users may view/update a company only when auth.uid() is linked via company_admins.';

create policy if not exists "company_admins_manage_self"
  on public.company_admins
  for all
  to authenticated
  using (admin_uuid = auth.uid())
  with check (admin_uuid = auth.uid());

comment on policy "company_admins_manage_self" on public.company_admins is
  'Authenticated users may view/update their own admin record; Edge Function inserts records.';

-- Helper role for the Edge Function ----------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'fn_register_organization_executor') then
    create role fn_register_organization_executor noinherit;
  end if;
end
$$;

grant usage on schema public to fn_register_organization_executor;
grant select, insert, update on public.companies to fn_register_organization_executor;
grant select, insert, update on public.company_admins to fn_register_organization_executor;

comment on role fn_register_organization_executor is
  'Role assumed by the register_organization Edge Function (security definer) for transactional inserts.';
