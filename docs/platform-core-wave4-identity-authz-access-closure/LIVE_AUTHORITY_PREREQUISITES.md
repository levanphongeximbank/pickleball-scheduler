# Live authority prerequisites (read-only preflight later)

`TENANT_MEMBERS_LIVE_READINESS=NOT_VERIFIED`

Do **not** deploy this Draft PR until a separate Owner-authorized read-only preflight proves:

1. `public.tenant_members` exists on the target environment.
2. Columns match repository expectation: `tenant_id`, `user_id`, `role_code` (`tenant_owner` \| `tenant_staff`), `status` (`active` \| `inactive`).
3. Current operators have valid active memberships (or Super Admin global role).
4. RLS permits canonical authenticated reads of own memberships.
5. No current Production actor would be unintentionally locked out by fail-closed app behavior.
6. Identity RPCs `identity_list_users` / `identity_admin_update_user` are deployed (secure runtime no longer falls back to `profiles.select("*")`).
7. `user_tenant_id()` COALESCE(venue) is still present (intentionally). App no longer invents tenantId from venueId.

If live authority is not ready, secure app behavior remains fail-closed. Do **not** compensate with `profiles.tenant_id`.
