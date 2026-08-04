-- Phase 6 / CLUB_DATA_V3_ANON_POLICY_REMEDIATION_02 rollback
-- STAGING CANDIDATE ONLY. DO NOT APPLY WITHOUT OWNER ROLLBACK GO.
-- Restores exactly the three legacy policies observed before remediation.
-- Data mutations: 0. Table ACLs and authenticated policies stay unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.club_data_v3') is null then
    raise exception 'required table public.club_data_v3 is missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'club_data_v3'
      and policyname in (
        'club_data_v3_anon_select',
        'club_data_v3_anon_insert',
        'club_data_v3_anon_update'
      )
  ) then
    raise exception 'one or more rollback target policies already exist';
  end if;
end
$preflight$;

create policy club_data_v3_anon_select
  on public.club_data_v3
  for select
  to anon
  using (true);

create policy club_data_v3_anon_insert
  on public.club_data_v3
  for insert
  to anon
  with check (true);

create policy club_data_v3_anon_update
  on public.club_data_v3
  for update
  to anon
  using (true)
  with check (true);

commit;
