-- Phase 6 / CLUB_DATA_V3_ANON_POLICY_REMEDIATION_02
-- STAGING CANDIDATE ONLY. DO NOT APPLY WITHOUT OWNER GO.
-- Target when approved: qyewbxjsiiyufanzcjcq (Staging only).
-- Data mutations: 0. Schema, table ACLs, and authenticated policies stay unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_policy_count integer;
begin
  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'club_data_v3'
      and c.relkind = 'r'
      and c.relrowsecurity
  ) then
    raise exception 'required RLS-enabled table public.club_data_v3 is missing';
  end if;

  select count(*) into v_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'club_data_v3'
    and policyname in (
      'club_data_v3_anon_select',
      'club_data_v3_anon_insert',
      'club_data_v3_anon_update'
    )
    and 'anon' = any (roles)
    and permissive = 'PERMISSIVE';

  if v_policy_count <> 3 then
    raise exception 'expected exactly 3 legacy anon policies; found %', v_policy_count;
  end if;
end
$preflight$;

drop policy club_data_v3_anon_select on public.club_data_v3;
drop policy club_data_v3_anon_insert on public.club_data_v3;
drop policy club_data_v3_anon_update on public.club_data_v3;

commit;
