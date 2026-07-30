-- PLATFORM-HARD-CUTOVER Staging rollback
-- TARGET ONLY: qyewbxjsiiyufanzcjcq
-- Removes only Owner view mappings created by this package.
-- Does NOT remove SUPER_ADMIN / PLATFORM_ADMIN grants.
-- Do NOT auto-run. Owner GO required.

delete from public.role_permissions
where permission_id = 'pairing.private_rules.view'
  and role_id in ('COURT_OWNER', 'VENUE_OWNER');
