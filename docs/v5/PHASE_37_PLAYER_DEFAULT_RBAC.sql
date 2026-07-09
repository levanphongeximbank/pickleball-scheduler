-- Phase 37 — Đồng bộ phân quyền mặc định VĐV (PLAYER) với rolePermissions.js
-- Chạy trên Production sau deploy v5.3.5+
-- Nguồn: src/features/identity/matrix/rolePermissions.js → PLAYER_DEFAULT_PERMISSION_IDS

-- Gỡ quyền ghi/legacy không thuộc ma trận VĐV mặc định
delete from public.role_permissions
where role_id = 'PLAYER'
  and permission_id in (
    'tournament.create',
    'tournament.update',
    'tournament.delete',
    'club.view',
    'club.create',
    'club.update',
    'club.delete',
    'booking.view',
    'booking.create',
    'finance.view',
    'court.view',
    'user.manage',
    'role.manage'
  );

-- Ma trận mặc định VĐV (mirror PLAYER_DEFAULT_PERMISSION_IDS)
insert into public.role_permissions (role_id, permission_id)
select 'PLAYER', p.id
from public.permissions p
where p.id in (
  'tournament.view',
  'statistics.view',
  'player.view',
  'player.update',
  'skill_level.view_private',
  'skill_level.request_change',
  'team.view',
  'team.lineup.submit',
  'team.standings.view'
)
on conflict do nothing;

-- Verification
select permission_id
from public.role_permissions
where role_id = 'PLAYER'
order by permission_id;
