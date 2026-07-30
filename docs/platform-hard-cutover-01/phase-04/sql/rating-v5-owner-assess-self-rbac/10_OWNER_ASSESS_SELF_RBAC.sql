-- PLATFORM-HARD-CUTOVER Staging remediation
-- TARGET ONLY: qyewbxjsiiyufanzcjcq — Owner GO required. Do not apply to Production.
-- Root cause: A-RATE FORBIDDEN because rating_v5.assess_self is missing for owner roles.
-- Grant self-assessment permissions to COURT_OWNER / VENUE_OWNER only.

insert into public.permissions (id, module, action, description) values
  ('rating_v5.view_own', 'rating_v5', 'view', 'Xem hồ sơ rating V5 của mình'),
  ('rating_v5.assess_self', 'rating_v5', 'assess', 'Tự đánh giá questionnaire V5')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in ('COURT_OWNER', 'VENUE_OWNER')
  and p.id in ('rating_v5.view_own', 'rating_v5.assess_self')
on conflict do nothing;
