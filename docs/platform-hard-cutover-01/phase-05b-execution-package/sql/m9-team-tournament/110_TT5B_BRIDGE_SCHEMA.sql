-- Phase TT-5B — Bridge schema (Team Tournament ↔ Referee V5)
-- Staging only | idempotent | non-destructive
-- Production impact: NONE

-- ═══════════════════════════════════════════════════════════════════
-- 1. Bridge table
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_sub_match_referee_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  matchup_id uuid not null references public.team_tournament_matchups(id) on delete cascade,
  external_matchup_id text not null,
  sub_match_id uuid not null references public.team_tournament_sub_matches(id) on delete cascade,
  external_sub_match_id text not null,
  referee_match_id text not null,
  referee_assignment_id uuid references public.referee_assignments(id) on delete set null,
  status text not null default 'provisioned'
    check (status in (
      'pending', 'provisioned', 'assigned', 'active',
      'finalized', 'sync_error', 'revoked', 'reprovision_required'
    )),
  provision_version integer not null default 1 check (provision_version >= 1),
  provisioned_at timestamptz,
  linked_at timestamptz,
  locked_at timestamptz,
  last_result_revision_id uuid,
  last_outbox_event_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  revoke_reason text,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  unique (sub_match_id),
  unique (referee_match_id),
  unique (tenant_id, external_sub_match_id)
);

create index if not exists idx_tt5b_referee_links_tournament
  on public.team_sub_match_referee_links (tenant_id, tournament_id, status);

create index if not exists idx_tt5b_referee_links_matchup
  on public.team_sub_match_referee_links (matchup_id, status);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Helpers
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_referee_link_blocks_legacy(
  p_status text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_status, '') in (
    'pending', 'provisioned', 'assigned', 'active', 'finalized', 'sync_error', 'reprovision_required'
  );
$$;

create or replace function public.team_tournament_sub_match_is_dreambreaker(
  p_sub_match public.team_tournament_sub_matches,
  p_matchup public.team_tournament_matchups
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_discipline record;
begin
  if exists (
    select 1 from public.team_tournament_dreambreaker_states d
    where d.matchup_id = p_matchup.id
      and coalesce(d.sub_match_external_id, '') = p_sub_match.external_sub_match_id
  ) then
    return true;
  end if;

  select * into v_discipline
  from public.team_tournament_disciplines d
  where d.team_tournament_id = p_matchup.team_tournament_id
    and d.external_discipline_id = p_sub_match.discipline_external_id;

  if v_discipline.id is not null then
    if lower(coalesce(v_discipline.name, '')) like '%dreambreaker%'
      or lower(coalesce(v_discipline.external_discipline_id, '')) like '%dreambreaker%' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.team_tournament_get_active_referee_link(
  p_sub_match_id uuid
)
returns public.team_sub_match_referee_links
language sql
stable
set search_path = public
as $$
  select l.*
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match_id
    and l.status not in ('revoked')
  limit 1;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════════════════════════════════
alter table public.team_sub_match_referee_links enable row level security;

drop policy if exists tt5b_referee_links_manage on public.team_sub_match_referee_links;
create policy tt5b_referee_links_manage on public.team_sub_match_referee_links
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

drop policy if exists tt5b_referee_links_referee_select on public.team_sub_match_referee_links;
create policy tt5b_referee_links_referee_select on public.team_sub_match_referee_links
  for select
  using (
    public.is_super_admin()
    or (
      public.referee_v5_current_user_has_assignment(tenant_id, tournament_id, referee_match_id)
    )
  );

revoke all on public.team_sub_match_referee_links from anon;
grant select, insert, update on public.team_sub_match_referee_links to authenticated;
grant all on public.team_sub_match_referee_links to service_role;

comment on table public.team_sub_match_referee_links is
  'TT-5B bridge: team sub-match external_sub_match_id ↔ Referee V5 match_id';
