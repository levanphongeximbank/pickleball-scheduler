-- Phase 33 — tenant.role.customize (chủ sân tùy chỉnh quyền nhân viên)
-- Mirror: src/features/identity/constants/permissions.js (TENANT_ROLE_CUSTOMIZE)
-- Applied staging via MCP: phase_33_tenant_role_customize

insert into public.permissions (id, module, action, description)
values (
  'tenant.role.customize',
  'tenant',
  'role.customize',
  'Tùy chỉnh quyền nhân viên trong phạm vi cơ sở'
)
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.role_id, 'tenant.role.customize'
from (values ('VENUE_OWNER'), ('COURT_OWNER')) as r(role_id)
join public.roles roles on roles.id = r.role_id
on conflict do nothing;

-- Verify:
-- select * from public.permissions where id = 'tenant.role.customize';
-- select role_id from public.role_permissions where permission_id = 'tenant.role.customize';
