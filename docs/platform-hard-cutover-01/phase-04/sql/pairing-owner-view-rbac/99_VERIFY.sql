-- Read-only verify for Owner pairing.view RBAC.
-- TARGET ONLY: qyewbxjsiiyufanzcjcq

select id, module, action
from public.permissions
where id = 'pairing.private_rules.view';

select rp.role_id, rp.permission_id
from public.role_permissions rp
where rp.permission_id = 'pairing.private_rules.view'
  and rp.role_id in ('COURT_OWNER', 'VENUE_OWNER', 'PLAYER', 'SUPER_ADMIN', 'PLATFORM_ADMIN')
order by rp.role_id;

select
  exists (
    select 1 from public.role_permissions
    where role_id = 'COURT_OWNER' and permission_id = 'pairing.private_rules.view'
  ) as court_owner_view,
  exists (
    select 1 from public.role_permissions
    where role_id = 'VENUE_OWNER' and permission_id = 'pairing.private_rules.view'
  ) as venue_owner_view,
  exists (
    select 1 from public.role_permissions
    where role_id in ('COURT_OWNER', 'VENUE_OWNER')
      and permission_id in (
        'pairing.private_rules.edit',
        'pairing.private_rules.manage',
        'pairing.private_rules.admin'
      )
  ) as owners_got_edit_or_admin;
