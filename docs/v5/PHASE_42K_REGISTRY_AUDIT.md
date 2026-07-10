# Phase 42K — Registry Audit (pre-implementation)

**Date:** 2026-07-10  
**Version baseline:** 5.3.32  
**Blueprint:** `PHASE_42X_CLUB_UX_BLUEPRINT.md` §42K

## Executive summary

`/manage/clubs` vẫn đọc **localStorage registry** (`loadClubs` → `getClubsVisibleToUser`). V2 `syncClubRegistryForUser` gọi **`club_list_discoverable`** nhưng **không ghi** vào local — nên trang quản trị và cloud SSOT **lệch nhau**. Super Admin còn **auto-pick `listTenants()[0]`** làm `currentTenantId`.

## Call sites

### `loadClubs()` / `saveClubs()`

| Area | File | Role |
|------|------|------|
| Registry SoT | `src/data/club.js:58,87` | localStorage `pickleball-clubs-v1` |
| Club context | `src/context/ClubContext.jsx:33+` | State hydrate + mutations |
| Tenant guard | `src/features/tenant/guards/tenantGuard.js:144+` | Filter clubs by tenant |
| Access | `src/features/club/services/clubAccessService.js:52+` | `getClubsVisibleToUser` |
| **Manage UI** | `src/pages/clubs/ClubListPage.jsx:96` | **Primary bug — admin list** |
| Discover legacy | `src/pages/player/myClub/MyClubDiscoverPanel.jsx:59+` | Pre-V2 sync |
| Domain | `src/domain/clubService.js` | CRUD local |
| API handlers | `src/features/api/router/handlers/clubsHandler.js` | Dev API |
| Tests | `tests/club*.test.js` | Fixtures |

### `syncClubRegistryForUser()`

| File | Line | Behavior |
|------|------|----------|
| `src/auth/authService.js` | 278, 316 | Login / profile refresh |
| `src/context/ClubContext.jsx` | 72 | Club provider boot |
| `src/pages/clubs/ClubListPage.jsx` | **79** | **Mount sync — ineffective V2** |
| `src/pages/player/myClub/MyClubDiscoverPanel.jsx` | 60 | Legacy discover hydrate |
| `src/features/club/services/clubRegistryCloudService.js` | 88, 137 | After upsert |

### `club_list_registry` / `club_list_discoverable`

| Client | RPC | Params |
|--------|-----|--------|
| `clubStorageV2RpcService.js:108` | `club_list_registry` | `p_tenant_id`, `p_include_inactive` |
| `clubStorageV2RpcService.js:123` | `club_list_discoverable` | `p_search`, `p_limit` |
| `clubRegistryRpcService.js:69,103` | legacy overload | `p_venue_id` (pre-42C) |
| `clubRegistryCloudSync.js:76` | **discover only (V2)** | Wrong RPC for admin |
| `clubRegistryCloudSync.js:198-205` | registry/discover mix | Legacy pull → `mergeClubsIntoLocal` |

## Root causes

### RC-1 — Admin list = local SoT

```95:108:src/pages/clubs/ClubListPage.jsx
  const clubsWithStats = useMemo(() => {
    const clubs = getClubsVisibleToUser(currentTenantId, user).filter((c) => !c.isDefault);
```

`getClubsVisibleToUser` → `loadClubs()` / `listClubsForTenant` — **không** gọi `club_list_registry`.

### RC-2 — V2 sync không feed manage page

```74:86:src/features/club/services/clubRegistryCloudSync.js
  if (isClubStorageV2Enabled()) {
    const listResult = await rpcV2ClubListDiscoverable({ limit: 200 });
    ...
    return { ok: true, pulled: ..., provider: "v2-rpc" };
  }
```

Discover RPC ≠ tenant registry; kết quả **không** merge local. `ClubListPage` vẫn đọc local → **empty/stale** trên máy admin.

### RC-3 — SA tenant auto-fallback

```56:67:src/context/TenantContext.jsx
    if (canPickTenant) {
      return (
        adminTenantId ||
        loadActiveTenantId() ||
        listTenants()[0]?.id ||
        null
      );
```

```150:158:src/context/TenantContext.jsx
    const firstTenantId = listTenants()[0].id;
    saveActiveTenantId(firstTenantId);
    setAdminTenantId(firstTenantId);
```

SA có thể thao tác tenant **chưa chọn** — vi phạm blueprint §8.3.

### RC-4 — `currentTenantId` resolve

| Persona | Source |
|---------|--------|
| Tenant user | `resolveEffectiveTenantId(user)` → `profiles.tenant_id` / `venue_id` / club blob |
| SA / Platform | `adminTenantId` \|\| session \|\| **`listTenants()[0]`** |

Không có cloud tenant membership lookup cho SA (by design); tenant pick phải **explicit**.

### RC-5 — No platform registry route

Không có `/platform/clubs`. SA cross-tenant xem qua local `getClubsVisibleToUser` (toàn bộ `loadClubs`) — **không** RPC-scoped.

### RC-6 — No registry cache layer

Không có React Query / scoped cache. `localRevision` bump thủ công sau sync.

## RPC contract (existing — no SQL change 42K)

`club_list_registry(p_tenant_id, p_include_inactive)` → `{ ok, data: phase42_club_canonical[] }`

Fields: `id`, `tenant_id`, `name`, `code`, `status`, `owner_label`, `president_label`, `active_member_count`, `version`, `created_at`, `updated_at`.

`pending_request_count` — **chưa** trong `phase42_club_canonical` (UI hiển thị `—` hoặc phase sau).

## Implementation scope (42K)

- `clubRegistryService` + `useClubRegistry` cache `['club-registry', scope, tenantId, filters]`
- Refactor `/manage/clubs` → tenant registry RPC
- New `/platform/clubs` → cross-tenant registry
- Fix `TenantContext` SA tenant selection
- Deprecate local SoT paths when `VITE_CLUB_STORAGE_V2=true`
- Tests + staging QA gate

**Stop:** await `GO DEPLOY 42K` — no Production deploy in this phase.
