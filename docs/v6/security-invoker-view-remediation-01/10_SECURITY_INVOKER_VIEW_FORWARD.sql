-- Phase 6 / SECURITY_INVOKER_VIEW_REMEDIATION_01
-- STAGING CANDIDATE ONLY. DO NOT APPLY WITHOUT OWNER GO.
-- Target when approved: qyewbxjsiiyufanzcjcq (Staging only).
-- Data mutations: 0. View definitions and ACLs remain unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'security_invoker views require PostgreSQL 15 or newer';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'tenants'
      and c.relkind = 'v'
  ) then
    raise exception 'required view public.tenants is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'club_data_v3_safe'
      and c.relkind = 'v'
  ) then
    raise exception 'required view public.club_data_v3_safe is missing';
  end if;
end
$preflight$;

alter view public.tenants
  set (security_invoker = true);

alter view public.club_data_v3_safe
  set (security_invoker = true);

commit;
