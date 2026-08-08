# Auth / Tenant / RPC Authorization

## Frontend gates (unchanged)

- RouteAccessGate / PermissionGate on Tournament routes
- `usePageRuntimeAccess("tournament.manage", …)` on create

## SECURITY DEFINER RPCs (migration package)

Each RPC fails closed on:

1. Tenant scope — `user_venue_id()` / `is_super_admin()` via `canonical_tournament_assert_tenant`
2. Permission — `user_has_permission(...)` using existing keys:
   - `tournament.view` — list / get / list_mine
   - `tournament.create` — create
   - `tournament.update` — update / apply_engine
   - `tournament.delete` — delete

## EXECUTE privileges

- `REVOKE ALL … FROM PUBLIC`
- `REVOKE ALL … FROM anon`
- `GRANT EXECUTE … TO authenticated`

## Tenant fail-closed (app)

`requireExplicitTenantForClub` rejects missing / `default-tenant`.

Frontend gates do **not** replace RPC authorization — both layers required before live use.
