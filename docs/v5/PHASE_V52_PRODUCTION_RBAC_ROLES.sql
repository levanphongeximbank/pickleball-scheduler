-- =============================================================================
-- V5.2 — Production RBAC: SYSTEM_TECHNICIAN + TEAM_CAPTAIN
-- Project: expuvcohlcjzvrrauvud (pickleball-scheduler-production)
--
-- Tiên quyết:
--   • Gate 2 SQL (22/22) đã apply
--   • public.roles / permissions / role_permissions đã tồn tại (supabase-rbac-v4)
--   • PHASE_23C permissions patch đã apply (team.* cơ bản)
--
-- Idempotent · additive only · không xóa dữ liệu
-- Chạy: Supabase Dashboard → SQL Editor (service_role)
-- =============================================================================

-- ─── 1. profiles — cột scope đội trưởng ─────────────────────────────────────
alter table public.profiles
  add column if not exists tournament_id text,
  add column if not exists team_id text;

comment on column public.profiles.tournament_id is
  'V5.2 TEAM_CAPTAIN — tournament_id blob hoặc team_tournaments.tournament_id';
comment on column public.profiles.team_id is
  'V5.2 TEAM_CAPTAIN — external_team_id trong giải đồng đội';

-- ─── 2. profiles_role_check — mở rộng V5.2 (giữ legacy v4) ─────────────────
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    -- Legacy v4 (DB)
    'SUPER_ADMIN',
    'VENUE_OWNER', 'VENUE_MANAGER',
    'COURT_OWNER', 'COURT_MANAGER',
    'CASHIER', 'ACCOUNTANT', 'REFEREE',
    'CLUB_OWNER', 'PLAYER',
    -- V5 canonical
    'PLATFORM_ADMIN',
    'SYSTEM_TECHNICIAN',
    'TENANT_OWNER',
    'TOURNAMENT_MANAGER',
    'TEAM_CAPTAIN',
    'CLUB_MANAGER',
    'COACH',
    'STAFF',
    'CUSTOMER',
    'SUPPORT'
  ));

-- ─── 3. roles catalog ───────────────────────────────────────────────────────
insert into public.roles (id, label, description) values
  ('PLATFORM_ADMIN', 'Quản trị nền tảng', 'Alias SUPER_ADMIN — V5 canonical'),
  ('SYSTEM_TECHNICIAN', 'Kỹ thuật viên hệ thống', 'V5.2 — platform scope, view/limited'),
  ('TENANT_OWNER', 'Chủ đơn vị / Chủ sân', 'Alias COURT_OWNER — V5 canonical'),
  ('TOURNAMENT_MANAGER', 'Quản lý giải', 'V5 — tournament scope'),
  ('TEAM_CAPTAIN', 'Trưởng nhóm / Đội trưởng', 'V5.2 — tournament + team scope'),
  ('CLUB_MANAGER', 'Quản lý CLB', 'Alias CLUB_OWNER — V5 canonical'),
  ('COACH', 'Huấn luyện viên', 'V5'),
  ('STAFF', 'Nhân viên', 'V5'),
  ('CUSTOMER', 'Khách hàng', 'V5'),
  ('SUPPORT', 'Hỗ trợ', 'V5')
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description;

-- ─── 4. V5.1/V5.2 permissions catalog ─────────────────────────────────────
insert into public.permissions (id, module, action, description) values
  ('system.health.view', 'system', 'health_view', 'Xem sức khỏe hệ thống'),
  ('system.log.view', 'system', 'log_view', 'Xem log hệ thống'),
  ('system.config.view', 'system', 'config_view', 'Xem cấu hình hệ thống'),
  ('system.config.update_limited', 'system', 'config_update_limited', 'Sửa cấu hình giới hạn'),
  ('tenant.view', 'tenant', 'view', 'Xem tenant'),
  ('user.view', 'user', 'view', 'Xem người dùng (read-only)'),
  ('role.view', 'role', 'view', 'Xem vai trò'),
  ('permission.view', 'permission', 'view', 'Xem quyền'),
  ('activity_log.view', 'activity_log', 'view', 'Xem nhật ký hoạt động'),
  ('integration.test', 'integration', 'test', 'Kiểm thử tích hợp'),
  ('support_ticket.manage', 'support_ticket', 'manage', 'Quản lý ticket hỗ trợ'),
  ('data_diagnostic.view', 'data_diagnostic', 'view', 'Chẩn đoán dữ liệu'),
  ('migration_status.view', 'migration_status', 'view', 'Trạng thái migration'),
  ('team_member.view', 'team_member', 'view', 'Đội trưởng — xem thành viên'),
  ('team_member.propose', 'team_member', 'propose', 'Đội trưởng — đề xuất thành viên'),
  ('team_member.manage_limited', 'team_member', 'manage_limited', 'Đội trưởng — quản lý giới hạn'),
  ('team_lineup.view', 'team_lineup', 'view', 'Đội trưởng — xem đội hình'),
  ('team_lineup.submit', 'team_lineup', 'submit', 'Đội trưởng — nộp đội hình'),
  ('team_lineup.update_before_lock', 'team_lineup', 'update_before_lock', 'Sửa đội hình trước khóa'),
  ('team_schedule.view', 'team_schedule', 'view', 'Lịch thi đấu đội'),
  ('team_result.view', 'team_result', 'view', 'Kết quả đội'),
  ('team_message.send', 'team_message', 'send', 'Nhắn tin đội'),
  ('team_checkin.view', 'team_checkin', 'view', 'Xem check-in đội'),
  ('team_checkin.confirm', 'team_checkin', 'confirm', 'Xác nhận check-in'),
  ('team_attendance.confirm', 'team_attendance', 'confirm', 'Xác nhận điểm danh'),
  ('team_substitution.request', 'team_substitution', 'request', 'Yêu cầu thay người'),
  ('team_event.view', 'team_event', 'view', 'Xem sự kiện giải đồng đội'),
  ('team_event.manage', 'team_event', 'manage', 'Quản lý sự kiện giải đồng đội'),
  ('existing_team.view', 'existing_team', 'view', 'Xem đội có sẵn'),
  ('existing_team.select', 'existing_team', 'select', 'Chọn đội có sẵn'),
  ('existing_team.manage', 'existing_team', 'manage', 'Quản lý đội có sẵn'),
  ('in_tournament_team.view', 'in_tournament_team', 'view', 'Xem đội trong giải'),
  ('in_tournament_team.create', 'in_tournament_team', 'create', 'Tạo đội trong giải'),
  ('in_tournament_team.update', 'in_tournament_team', 'update', 'Sửa đội trong giải'),
  ('in_tournament_team.delete', 'in_tournament_team', 'delete', 'Xóa đội trong giải'),
  ('team_manual_split.view', 'team_manual_split', 'view', 'Xem chia đội thủ công'),
  ('team_manual_split.manage', 'team_manual_split', 'manage', 'Chia đội thủ công'),
  ('team_auto_draw.view', 'team_auto_draw', 'view', 'Xem bốc thăm tự động'),
  ('team_auto_draw.manage', 'team_auto_draw', 'manage', 'Bốc thăm tự động'),
  ('team_draft.view', 'team_draft', 'view', 'Xem draft đội'),
  ('team_draft.manage', 'team_draft', 'manage', 'Quản lý draft đội'),
  ('team_captain.assign', 'team_captain', 'assign', 'Gán đội trưởng'),
  ('team_captain.remove', 'team_captain', 'remove', 'Gỡ đội trưởng'),
  ('team_captain.view', 'team_captain', 'view', 'Xem đội trưởng'),
  ('team_lineup.approve', 'team_lineup', 'approve', 'Duyệt đội hình'),
  ('team_lineup.lock', 'team_lineup', 'lock', 'Khóa đội hình V5'),
  ('team_substitution.approve', 'team_substitution', 'approve', 'Duyệt thay người')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- ─── 5. SYSTEM_TECHNICIAN role_permissions ───────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select 'SYSTEM_TECHNICIAN', p.id
from public.permissions p
where p.id in (
  'system.health.view',
  'system.log.view',
  'system.config.view',
  'system.config.update_limited',
  'tenant.view',
  'venue.view',
  'user.view',
  'role.view',
  'permission.view',
  'activity_log.view',
  'integration.view',
  'integration.test',
  'support_ticket.manage',
  'data_diagnostic.view',
  'migration_status.view',
  'settings.view'
)
on conflict do nothing;

-- ─── 6. TEAM_CAPTAIN role_permissions (mirror rolePermissions.js) ─────────────
insert into public.role_permissions (role_id, permission_id)
select 'TEAM_CAPTAIN', p.id
from public.permissions p
where p.id in (
  'tournament.view',
  'team.view',
  'team.lineup.submit',
  'team.standings.view',
  'team_member.view',
  'team_member.propose',
  'team_member.manage_limited',
  'team_lineup.view',
  'team_lineup.submit',
  'team_lineup.update_before_lock',
  'team_schedule.view',
  'team_result.view',
  'team_message.send',
  'team_checkin.view',
  'team_checkin.confirm',
  'team_attendance.confirm',
  'team_substitution.request'
)
on conflict do nothing;

-- SUPER_ADMIN / PLATFORM_ADMIN: toàn quyền permission mới
insert into public.role_permissions (role_id, permission_id)
select r.role_id, p.id
from (values ('SUPER_ADMIN'), ('PLATFORM_ADMIN')) as r(role_id)
cross join public.permissions p
where p.id like 'system.%'
   or p.id like 'team_%'
   or p.id like 'team.%'
   or p.id in ('tenant.view', 'user.view', 'role.view', 'permission.view',
               'activity_log.view', 'integration.test', 'support_ticket.manage',
               'data_diagnostic.view', 'migration_status.view')
on conflict do nothing;

-- ─── 7. Test account — đội trưởng (owner chỉnh tournament_id / team_id) ───
-- Sau khi tạo giải đồng đội trên Production, cập nhật 2 cột dưới đây.
update public.profiles
set
  role = 'TEAM_CAPTAIN',
  -- TODO owner: thay bằng tournament_id thật sau PROD-23E smoke
  tournament_id = coalesce(nullif(tournament_id, ''), 'REPLACE_ME_TOURNAMENT_ID'),
  team_id = coalesce(nullif(team_id, ''), 'REPLACE_ME_TEAM_EXTERNAL_ID'),
  updated_at = now()
where email = 'doitruong@gmail.com'
  and status = 'active';

-- ─── 8. Verification (V52-1 → V52-8) ────────────────────────────────────────
-- V52-1: roles mới
select id, label from public.roles
where id in ('SYSTEM_TECHNICIAN', 'TEAM_CAPTAIN', 'PLATFORM_ADMIN', 'TOURNAMENT_MANAGER')
order by id;

-- V52-2: constraint cho phép TEAM_CAPTAIN
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_role_check';

-- V52-3: cột scope
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('tournament_id', 'team_id');

-- V52-4: SYSTEM_TECHNICIAN permissions count
select count(*) as tech_perm_count
from public.role_permissions
where role_id = 'SYSTEM_TECHNICIAN';

-- V52-5: TEAM_CAPTAIN permissions count
select count(*) as captain_perm_count
from public.role_permissions
where role_id = 'TEAM_CAPTAIN';

-- V52-6: doitruong role
select email, role, venue_id, tournament_id, team_id, status
from public.profiles
where email = 'doitruong@gmail.com';

-- V52-7: không role lạ
select distinct role
from public.profiles
where role is not null
  and role not in (
    'SUPER_ADMIN', 'PLATFORM_ADMIN', 'SYSTEM_TECHNICIAN',
    'VENUE_OWNER', 'VENUE_MANAGER', 'COURT_OWNER', 'COURT_MANAGER',
    'TENANT_OWNER', 'TOURNAMENT_MANAGER', 'TEAM_CAPTAIN',
    'CASHIER', 'ACCOUNTANT', 'REFEREE',
    'CLUB_OWNER', 'CLUB_MANAGER', 'COACH', 'STAFF',
    'PLAYER', 'CUSTOMER', 'SUPPORT'
  );

-- V52-8: SYSTEM_TECHNICIAN không có role.manage / billing.tenant.lock
select rp.permission_id
from public.role_permissions rp
where rp.role_id = 'SYSTEM_TECHNICIAN'
  and rp.permission_id in ('role.manage', 'billing.tenant.lock', 'tournament.delete');
