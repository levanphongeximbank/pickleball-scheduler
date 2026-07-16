-- Phase P1.3 — Team Tournament V6 domain persistence schema
-- Staging-only apply after prerequisite review. Do not apply to Production.
-- Prerequisites: PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql,
-- PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql, PHASE_P1_2_S1B_SNAPSHOT_SCHEMA.sql.

create extension if not exists pgcrypto with schema extensions;

-- App constants: DISCIPLINE_KIND = doubles|dreambreaker;
-- ACTIVATION_RULE = always|tie_at_2_2.
alter table public.team_tournament_disciplines
  add column if not exists discipline_kind text not null default 'doubles',
  add column if not exists activation_rule text not null default 'always',
  add column if not exists enabled boolean not null default true;

alter table public.team_tournament_disciplines
  drop constraint if exists team_tournament_disciplines_discipline_kind_check;
alter table public.team_tournament_disciplines
  add constraint team_tournament_disciplines_discipline_kind_check
  check (discipline_kind in ('doubles', 'dreambreaker'));

alter table public.team_tournament_disciplines
  drop constraint if exists team_tournament_disciplines_activation_rule_check;
alter table public.team_tournament_disciplines
  add constraint team_tournament_disciplines_activation_rule_check
  check (activation_rule in ('always', 'tie_at_2_2'));

create table if not exists public.team_tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_group_id text not null,
  name text not null,
  sort_order integer not null default 1,
  team_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_tournament_id, external_group_id)
);

do $fk$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_tournament_groups_tenant_id_fkey'
  ) then
    alter table public.team_tournament_groups
      add constraint team_tournament_groups_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end;
$fk$;

create index if not exists idx_team_tournament_groups_order
  on public.team_tournament_groups (team_tournament_id, sort_order);

alter table public.team_tournament_groups enable row level security;
revoke all on public.team_tournament_groups from anon;
grant select on public.team_tournament_groups to authenticated;

drop policy if exists team_tournament_groups_select on public.team_tournament_groups;
create policy team_tournament_groups_select
  on public.team_tournament_groups
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select venue_id from public.profiles where id = auth.uid())
      and (
        public.team_tournament_can_manage()
        or public.user_has_permission('team.view')
      )
    )
  );

drop policy if exists team_tournament_groups_manage on public.team_tournament_groups;
create policy team_tournament_groups_manage
  on public.team_tournament_groups
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select venue_id from public.profiles where id = auth.uid())
      and public.team_tournament_can_manage()
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id = (select venue_id from public.profiles where id = auth.uid())
      and public.team_tournament_can_manage()
    )
  );
