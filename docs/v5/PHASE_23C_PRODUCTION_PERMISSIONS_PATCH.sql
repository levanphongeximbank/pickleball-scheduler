-- Phase 23C — Production recovery patch (permissions + role_permissions)
-- Idempotent. Chạy TRƯỚC khi re-apply PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql
-- nếu production chưa có team.* permissions hoặc apply 23C/23D bị lỗi FK.
--
-- Nguyên nhân lỗi thường gặp:
--   • Chạy PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql trên production
--     (file đó INSERT role_permissions nhưng KHÔNG INSERT permissions).
--   • Apply 23C fail giữa chừng → transaction rollback → permissions chưa commit.
--
-- Verify sau patch:
--   select id from public.permissions where id like 'team.%' order by id;
--   select role_id, permission_id from public.role_permissions
--   where permission_id like 'team.%' order by role_id, permission_id;

-- ─── 1. Permissions catalog (bắt buộc trước role_permissions) ───
insert into public.permissions (id, module, action, description)
values
  ('team.manage', 'team', 'manage', 'Quản lý đội giải đồng đội'),
  ('team.view', 'team', 'view', 'Xem đội giải đồng đội'),
  ('team.lineup.submit', 'team', 'lineup_submit', 'Đội trưởng nộp đội hình'),
  ('team.lineup.lock', 'team', 'lineup_lock', 'Khóa đội hình'),
  ('team.lineup.publish', 'team', 'lineup_publish', 'Công bố đội hình'),
  ('team.lineup.randomize', 'team', 'lineup_randomize', 'Random đội hình khi quá hạn'),
  ('team.match.result.manage', 'team', 'match_result_manage', 'Nhập kết quả trận đồng đội'),
  ('team.standings.view', 'team', 'standings_view', 'Xem BXH đồng đội')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- ─── 2. role_permissions (mirror src/features/identity/matrix/rolePermissions.js)
-- SUPER_ADMIN: mọi permission team.* mới
insert into public.role_permissions (role_id, permission_id)
select 'SUPER_ADMIN', p.id
from public.permissions p
where p.id like 'team.%'
on conflict do nothing;

-- COURT_OWNER / COURT_MANAGER: full team tournament ops (trừ lineup.submit)
insert into public.role_permissions (role_id, permission_id)
select r.role_id, p.id
from (values ('COURT_OWNER'), ('COURT_MANAGER')) as r(role_id)
cross join public.permissions p
where p.id in (
  'team.manage',
  'team.view',
  'team.lineup.lock',
  'team.lineup.publish',
  'team.lineup.randomize',
  'team.match.result.manage',
  'team.standings.view'
)
on conflict do nothing;

-- Legacy aliases (production có thể còn VENUE_* trong roles / profiles)
insert into public.role_permissions (role_id, permission_id)
select
  case rp.role_id
    when 'COURT_OWNER' then 'VENUE_OWNER'
    when 'COURT_MANAGER' then 'VENUE_MANAGER'
  end,
  rp.permission_id
from public.role_permissions rp
where rp.role_id in ('COURT_OWNER', 'COURT_MANAGER')
  and rp.permission_id like 'team.%'
on conflict do nothing;

-- REFEREE
insert into public.role_permissions (role_id, permission_id)
values
  ('REFEREE', 'team.match.result.manage'),
  ('REFEREE', 'team.standings.view')
on conflict do nothing;

-- CLUB_OWNER
insert into public.role_permissions (role_id, permission_id)
select 'CLUB_OWNER', p.id
from public.permissions p
where p.id in (
  'team.manage',
  'team.view',
  'team.lineup.lock',
  'team.lineup.publish',
  'team.lineup.randomize',
  'team.match.result.manage',
  'team.standings.view'
)
on conflict do nothing;

-- PLAYER
insert into public.role_permissions (role_id, permission_id)
values
  ('PLAYER', 'team.view'),
  ('PLAYER', 'team.lineup.submit'),
  ('PLAYER', 'team.standings.view')
on conflict do nothing;

-- ─── 3. Verify (optional — comment out nếu chạy qua CI) ─────────
select count(*) as team_permission_count
from public.permissions
where id like 'team.%';

select role_id, count(*) as team_perm_count
from public.role_permissions
where permission_id like 'team.%'
group by role_id
order by role_id;
