-- PLATFORM-HARD-CUTOVER Staging remediation
-- TARGET ONLY: qyewbxjsiiyufanzcjcq — Owner GO required. Do not apply to Production.
-- A-PAIR: Owner (COURT_OWNER / VENUE_OWNER) needs pairing.private_rules.view
-- while VITE_PRIVATE_PAIRING_RULES_ENABLED remains true.
-- Grants VIEW only — no edit/admin/platform-wide review.

insert into public.permissions (id, module, action, description)
values (
  'pairing.private_rules.view',
  'pairing',
  'view',
  'Xem private pairing rules (read-only)'
)
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in ('COURT_OWNER', 'VENUE_OWNER')
  and p.id = 'pairing.private_rules.view'
on conflict do nothing;
