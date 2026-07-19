# 10 — Write Repository Wiring Plan

## Target architecture

```text
UI / callers
  → updatePlayerProfile(playerId, patch, options)   // sole public write
      → resolveCanonicalPlayerId (reject INVALID/UNMAPPED/AMBIGUOUS)
      → normalizeAndValidateWritePatch
      → PlayerProfileWriteRepository.saveProfileFields
          → durable profiles UPDATE (auth-linked row)
```

## Requirements

| Rule | Plan |
|------|------|
| One public write service | Keep `updatePlayerProfile` only |
| One canonical repo path | Replace unconfigured default with `createSupabaseProfilesPlayerWriteRepository` after migration |
| No direct UI writes | Deprecate AthleteSelfProfile demographics → route through Player service |
| No second Identity write API | Identity may be **called internally** for allowlisted columns; not a second public Player API |
| Transactions | Single profiles UPDATE per patch; no partial silent success — if any owned field fails validation, reject all |
| Error mapping | Map Postgrest/RLS failures → `PERSISTENCE_ERROR`; schema missing → `SCHEMA_MIGRATION_REQUIRED` |
| Auth context | Pass `authUserId` from resolution; enforce self or admin scope in repo |
| No duplicate identity | Never INSERT new profiles/player ids from this path; UPDATE by resolved auth link only |
| Non-auth playerId | Return explicit `PERSISTENCE_NOT_CONFIGURED` / `UNSUPPORTED_PERSONA` until later wave |

## Cutover sequence

1. Migration applied on Staging  
2. Implement durable repo (implementation task)  
3. Inject repo in app bootstrap for Player writes  
4. Redirect self demographics UI to `updatePlayerProfile`  
5. Remove/disable Pick_VN direct `updateSelfDemographics` for fields owned by Player (or make it call Player)  
6. Keep Identity writing only account fields + temporary bridge if needed  

## Memory double

Remains **tests only** (`durable: false`). Never default in production.
