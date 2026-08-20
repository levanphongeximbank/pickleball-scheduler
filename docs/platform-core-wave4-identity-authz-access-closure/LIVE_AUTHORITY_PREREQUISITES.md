# Live authority prerequisites (read-only preflight later)

`TENANT_MEMBERS_LIVE_READINESS=NOT_VERIFIED` until Owner-authorized **re-preflight** after architecture amendment.

`tenant_members` is **not** a login/universal membership table. Preflight counts of Players/Referees without rows are **not** a backfill mandate.

Do **not** deploy this Draft PR until a separate Owner-authorized read-only re-preflight proves:

1. `public.tenant_members` exists on the target environment.
2. Columns match repository expectation: `tenant_id`, `user_id`, `role_code` (`tenant_owner` \| `tenant_staff`), `status` (`active` \| `inactive`).
3. Tenant **operators** who perform Tenant operational actions have explicit active memberships (or Super Admin global role). Players/Referees/Club/Coach without membership are expected unless they perform Tenant operations.
4. RLS permits canonical authenticated reads of **own** memberships (plus Super Admin). Venue-as-Tenant fallback is retired on this table's policy after the authored package is applied.
5. No current Production actor would be unintentionally locked out by fail-closed **operational** Tenant actions. Non-operational domain experiences must not require this table.
6. Identity RPCs `identity_list_users` / `identity_admin_update_user` are deployed (secure runtime no longer falls back to `profiles.select("*")`). Canonical scope gap remains OPEN until a later GO.
7. `user_tenant_id()` COALESCE(venue) is still present (intentionally). App operational entitlement does not use that fallback.

If live authority is not ready, secure **Tenant operational** behavior remains fail-closed. Do **not** compensate with `profiles.tenant_id`.
