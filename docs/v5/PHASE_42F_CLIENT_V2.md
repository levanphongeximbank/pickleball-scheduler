# Phase 42F — Client V2 (Cloud SSOT)

**Gate:** `GO CLIENT V2` (received 2026-07-10)

## What shipped in code

1. Flag `VITE_CLUB_STORAGE_V2=true` → `isClubStorageV2Enabled()`
2. On boot (when flag on): `ensureStorageSchemaV42()` wipes business LocalStorage keys (no migrate)
3. When V2 on:
   - No legacy registry background push
   - No club blob auto cloud sync dual-write
   - `createClub` → `club_create` RPC
   - Discover / join / cancel / leave → Phase 42 RPCs
4. Default flag **off** — Production stays on legacy path until `GO PRODUCTION RESET` + prod schema V2

## Env

| Environment | `VITE_CLUB_STORAGE_V2` | Supabase project |
|-------------|------------------------|------------------|
| Local / Staging Preview | `true` | Staging |
| Production | `false` (until GO PRODUCTION) | Production |

## Files

- `src/features/club/config/clubRegistryFlags.js`
- `src/features/club/storage/storageSchemaV42.js`
- `src/features/club/services/clubStorageV2RpcService.js`
- `src/features/club/services/clubRegistryCloudSync.js`
- `src/features/club/services/clubTenantService.js`
- `src/features/club/services/clubMembershipRequestService.js`
- `src/pages/player/myClub/MyClubDiscoverPanel.jsx`
- `src/pages/player/myClub/JoinClubDialog.jsx`
- `src/ai/cloudSyncConfig.js`
- `src/main.jsx`

## Next gate

```text
GO PRODUCTION RESET
```

Only after Staging QA with V2 flag + Staging Supabase.
