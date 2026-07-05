-- Phase 23D — Staging probe helpers (reference only — staging QA)
-- Chạy trên staging SAU khi apply PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql
-- KHÔNG chạy trên Production.
--
-- Mục tiêu:
--   1. Align profile.player_id cho captain probe accounts
--   2. (Tuỳ chọn) Gán permission team.* cho manager/referee staging
--
-- Dữ liệu giải probe được seed bằng:
--   npm run seed:team-tournament-cloud -- --blob-path=tests/fixtures/team-tournament-blob-probe.json

-- ─── Captain A: player@staging.local → player-staging-a-1 ─────────
update public.profiles
set
  player_id = 'player-staging-a-1',
  status = 'active',
  venue_id = coalesce(venue_id, 'venue-staging-a')
where email = 'player@staging.local';

-- ─── Captain B (optional second account) ──────────────────────────
-- Tạo user staging riêng nếu cần probe đội B; mặc định verify dùng Captain A + admin.

-- ─── Manager/Referee: team.match.result.manage ────────────────────
-- Phase 23C permissions đã insert vào public.permissions.
-- Gán role_permissions cho staging roles (idempotent):
insert into public.role_permissions (role_id, permission_id)
values
  ('COURT_MANAGER', 'team.match.result.manage'),
  ('COURT_MANAGER', 'team.standings.view'),
  ('VENUE_MANAGER', 'team.match.result.manage'),
  ('VENUE_MANAGER', 'team.standings.view'),
  ('REFEREE', 'team.match.result.manage'),
  ('COURT_OWNER', 'team.manage'),
  ('COURT_OWNER', 'team.lineup.lock'),
  ('COURT_OWNER', 'team.lineup.publish'),
  ('COURT_OWNER', 'team.standings.view'),
  ('VENUE_OWNER', 'team.manage'),
  ('VENUE_OWNER', 'team.lineup.lock'),
  ('VENUE_OWNER', 'team.lineup.publish'),
  ('VENUE_OWNER', 'team.standings.view'),
  ('CLUB_OWNER', 'team.view'),
  ('CLUB_OWNER', 'team.standings.view'),
  ('PLAYER', 'team.lineup.submit'),
  ('PLAYER', 'team.view')
on conflict do nothing;

-- ─── Verify header exists after JS seed ───────────────────────────
select
  tt.tournament_id,
  tt.tenant_id,
  tt.club_id,
  tt.name,
  tt.status,
  (select count(*) from public.team_tournament_teams t where t.team_tournament_id = tt.id) as teams,
  (select count(*) from public.team_tournament_matchups m where m.team_tournament_id = tt.id) as matchups
from public.team_tournaments tt
where tt.tournament_id = 'phase23d-probe-tournament';

-- Expected: 1 row, teams=2, matchups=1
