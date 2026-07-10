# Phase 42K — Registry Read Model Map

**Version:** 5.3.33  
**Status:** Implementation complete — **await GO DEPLOY 42K** (Staging QA required; no Production)

## Routes

| Route | Scope | RPC | Audience |
|-------|-------|-----|----------|
| `/manage/clubs` | `tenant` | `club_list_registry(p_tenant_id, p_include_inactive)` | Tenant staff / owner — **requires `currentTenantId`** |
| `/platform/clubs` | `platform` | `club_list_registry(p_tenant_id=null, …)` + client filters | `SUPER_ADMIN` / `PLATFORM_ADMIN` only |
| `/discover-clubs` | `discover` | `club_list_discoverable` | Players — **unchanged** |

## Cache key

```text
['club-registry', scope, tenantId, filters]
```

Implemented in `clubRegistryCache.js` + `useClubRegistry.js`.  
**Not** stored in localStorage.

## Invalidation triggers

- `bumpRevision()` membership (approve/leave/create)
- `switchTenant()` (SA)
- Club form success / approve / deactivate on `/manage/clubs`

## Deprecated (V2 on)

| Symbol | File | Replacement |
|--------|------|-------------|
| `loadClubs()` admin SoT | `ClubListPage` | `useClubRegistry` |
| `syncClubRegistryForUser` V2 discover | `clubRegistryCloudSync.js` | no-op → `clubRegistryService` |
| `pushPendingLocalClubsToCloud` | V2 | skipped |
| `listTenants()[0]` SA fallback | `TenantContext.jsx` | explicit tenant pick |

## Rollback

Redeploy previous Production deployment; no DB migration in 42K.

## Files touched

- `src/features/club/registry/clubRegistryCache.js` (new)
- `src/features/club/services/clubRegistryService.js` (new)
- `src/features/club/hooks/useClubRegistry.js` (new)
- `src/pages/clubs/ClubListPage.jsx`
- `src/pages/platform/PlatformClubsPage.jsx` (new)
- `src/context/TenantContext.jsx`
- `src/router.jsx`
- `tests/club-registry-42k.test.js`
