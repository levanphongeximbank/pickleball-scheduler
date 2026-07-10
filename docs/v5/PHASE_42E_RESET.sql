-- Phase 42E — Controlled reset of trial business data on STAGING only
-- Keeps: auth.users, profiles rows, venues, billing, roles/permissions, infra
-- Clears: club legacy + new empty tables reseeded; team tournament; clusters; checkins; trial audits

-- Child → parent truncates (RESTART IDENTITY CASCADE where safe)
truncate table
  public.team_tournament_sub_matches,
  public.team_tournament_matchups,
  public.team_tournament_lineup_entries,
  public.team_tournament_lineups,
  public.team_tournament_standings,
  public.team_tournament_team_members,
  public.team_tournament_teams,
  public.team_tournament_disciplines,
  public.team_tournament_audit_logs,
  public.team_tournaments
restart identity cascade;

truncate table public.tournament_match_live restart identity cascade;

truncate table public.checkins, public.qr_tokens restart identity cascade;

truncate table
  public.notification_logs,
  public.notifications,
  public.push_subscriptions
restart identity cascade;

truncate table public.club_membership_requests restart identity cascade;

truncate table public.club_data_v3, public.club_ai_data restart identity cascade;

truncate table public.club_governance restart identity cascade;

truncate table
  public.user_cluster_assignments,
  public.court_claim_requests,
  public.court_clusters
restart identity cascade;

truncate table
  public.court_engine_active_sessions,
  public.court_engine_stores
restart identity cascade;

truncate table public.pick_vn_player_ratings restart identity cascade;

truncate table
  public.marketplace_orders,
  public.marketplace_products
restart identity cascade;

truncate table
  public.payment_events,
  public.payment_transactions
restart identity cascade;

truncate table public.ai_suggestions restart identity cascade;

truncate table public.audit_logs, public.integration_audit_logs restart identity cascade;

-- New SSOT tables (empty after schema; ensure clean)
truncate table
  public.idempotency_requests,
  public.club_membership_requests_v42,
  public.club_governance_assignments,
  public.club_members,
  public.athletes,
  public.clubs,
  public.tenant_members
restart identity cascade;

-- Clear profile club binding (keep accounts)
update public.profiles
set club_id = null,
    player_id = null
where club_id is not null or player_id is not null;

-- Seed tenant_members from venue owners (not Super Admin as club member)
insert into public.tenant_members (tenant_id, user_id, role_code, status, version)
select p.venue_id, p.id, 'tenant_owner', 'active', 1
from public.profiles p
where p.venue_id is not null
  and upper(coalesce(p.role, '')) in ('VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER')
on conflict do nothing;

-- Fallback insert without relying on unique conflict target name
insert into public.tenant_members (tenant_id, user_id, role_code, status, version)
select x.venue_id, x.id, 'tenant_owner', 'active', 1
from (
  select p.venue_id, p.id
  from public.profiles p
  where p.venue_id is not null
    and upper(coalesce(p.role, '')) in ('VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER')
) x
where not exists (
  select 1 from public.tenant_members tm
  where tm.tenant_id = x.venue_id and tm.user_id = x.id and tm.status = 'active'
);

insert into public.tenant_members (tenant_id, user_id, role_code, status, version)
select p.venue_id, p.id, 'tenant_staff', 'active', 1
from public.profiles p
where p.venue_id is not null
  and upper(coalesce(p.role, '')) in ('VENUE_MANAGER', 'COURT_MANAGER')
  and not exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = p.venue_id and tm.user_id = p.id and tm.status = 'active'
  );
