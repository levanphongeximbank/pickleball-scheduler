# Auth / Tenant Preservation

## Preserved

- `PermissionGate` + `PERMISSIONS.TOURNAMENT_UPDATE` on create
- `usePageRuntimeAccess("tournament.manage", …)` on hub/create/list
- Existing route guards in router unchanged
- Team Tournament still uses existing TT service/RPC authz

## Fail-closed tenant (canonical writes)

- `requireExplicitTenantForClub(clubId)` rejects missing / `default-tenant` / `default`
- Canonical `createTournamentCommand` uses that check via transitional repository
- No new invention of `default-tenant` in canonical path

## Not mutated live

- No RLS policy changes applied to Staging/Production
- Local SQL package includes RLS drafts for `canonical_tournaments` only

## TOPBAR

- `TOPBAR_FIX_DEFERRED_TO_SEPARATE_SMALL_FIX=YES`
