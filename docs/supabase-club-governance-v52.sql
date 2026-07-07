-- Club Governance V5.2 — registry + RLS member visibility
-- Chạy SAU: supabase-club-v3.sql, supabase-rbac-v4.sql, supabase-club-v3-rls.sql
-- Spec: docs/v5/CLUB_GOVERNANCE_SPEC.md

-- ─── Registry (cloud mirror of local club governance) ───────────────────────

create table if not exists public.club_governance (
  club_id text primary key,
  venue_id text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  president_user_id uuid not null references auth.users(id) on delete restrict,
  vice_president_user_id uuid references auth.users(id) on delete set null,
  registered_court_ids jsonb not null default '[]'::jsonb,
  status text not null default 'active'
    check (status in ('pending_setup', 'pending_approval', 'active', 'inactive')),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_governance_venue_id_idx
  on public.club_governance (venue_id);

create index if not exists club_governance_president_user_id_idx
  on public.club_governance (president_user_id);

create index if not exists club_governance_owner_user_id_idx
  on public.club_governance (owner_user_id);

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.is_club_owner_for(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_governance g
    where g.club_id = p_club_id
      and g.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_club_president_for(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_governance g
    where g.club_id = p_club_id
      and g.president_user_id = auth.uid()
  );
$$;

create or replace function public.user_can_view_club_players(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.is_club_owner_for(p_club_id)
    or public.is_club_president_for(p_club_id)
    or exists (
      select 1 from public.club_governance g
      where g.club_id = p_club_id
        and g.vice_president_user_id = auth.uid()
    )
    or (
      public.user_club_id() = p_club_id
      and public.user_role() in ('CLUB_OWNER', 'CLUB_MANAGER', 'PLAYER')
    );
$$;

-- Strip players[] from club blob for venue staff who are not club owner.
create or replace function public.club_data_v3_redact_for_viewer(p_data jsonb, p_club_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
begin
  if public.user_can_view_club_players(p_club_id) then
    return v_data;
  end if;

  if public.is_super_admin()
    or public.user_role() in ('CLUB_OWNER', 'CLUB_MANAGER', 'PLAYER')
    and public.user_club_id() = p_club_id then
    return v_data;
  end if;

  -- Venue staff without club ownership: redact player arrays.
  return v_data
    - 'players'
    - 'members';
end;
$$;

-- ─── RLS: club_governance ───────────────────────────────────────────────────

alter table public.club_governance enable row level security;

drop policy if exists "club_governance_select" on public.club_governance;
drop policy if exists "club_governance_insert" on public.club_governance;
drop policy if exists "club_governance_update" on public.club_governance;

create policy "club_governance_select"
  on public.club_governance for select to authenticated
  using (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or president_user_id = auth.uid()
    or owner_user_id = auth.uid()
    or vice_president_user_id = auth.uid()
  );

create policy "club_governance_insert"
  on public.club_governance for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      venue_id = public.user_venue_id()
      and public.user_role() in ('VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER', 'SUPER_ADMIN')
    )
    or president_user_id = auth.uid()
  );

create policy "club_governance_update"
  on public.club_governance for update to authenticated
  using (
    public.is_super_admin()
    or (
      venue_id = public.user_venue_id()
      and public.user_role() in ('VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER')
    )
    or president_user_id = auth.uid()
    or owner_user_id = auth.uid()
  )
  with check (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or president_user_id = auth.uid()
    or owner_user_id = auth.uid()
  );

-- ─── RLS: club_data_v3 — tighten venue staff read ───────────────────────────

drop policy if exists "club_data_v3_member_select" on public.club_data_v3;

create policy "club_data_v3_member_select"
  on public.club_data_v3 for select to authenticated
  using (
    public.is_super_admin()
    or club_id = public.user_club_id()
    or (
      venue_id = public.user_venue_id()
      and (
        public.is_club_owner_for(club_id)
        or public.user_role() not in ('VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER', 'VENUE_MANAGER', 'COURT_MANAGER')
      )
    )
  );

-- View for clients: redacted blob (use in RPC pull if needed)
create or replace view public.club_data_v3_safe as
select
  d.club_id,
  public.club_data_v3_redact_for_viewer(d.data, d.club_id) as data,
  d.synced_at,
  d.venue_id
from public.club_data_v3 d;

grant select on public.club_data_v3_safe to authenticated;
