# CC-02D — Runtime RPC Wiring

## Flags

```text
VITE_COMPETITION_CORE_ENABLED=true
VITE_COMPETITION_CORE_RATING_V2_ENABLED=true
```

## Backend selection

| Path | When | SSOT |
|------|------|------|
| **Database RPC** | `applyEloFromMatchRecordAsync` + Supabase configured | `rating_applications` |
| **Blob atomic** | Sync `applyEloFromMatchRecord` default / RPC failure fallback | Local cache only |

## Modules

| File | Role |
|------|------|
| `ratingRpcService.js` | RPC payload builder, `applyMatchRatingViaRpc` |
| `ratingServiceV2.js` | Database-first with controlled blob fallback + mirror |
| `eloService.js` | Sync blob default; `applyEloFromMatchRecordAsync` prefers database |

## Flow (async / database)

1. Eligibility check (application layer)
2. Build updates from match record
3. Call `competition_core_apply_match_rating_v2` via Supabase client
4. On success → optional blob mirror for offline UI (`mirrorDatabaseRatingToClubBlob`)
5. On failure → blob fallback unless `fallbackBlobOnRpcFailure: false`

## RPC contract

```javascript
supabase.rpc('competition_core_apply_match_rating_v2', {
  p_match_id,
  p_tenant_id,
  p_tournament_id,
  p_updates: [{ playerId, previousRating, nextRating, delta }],
  p_engine_version,
});
```

## Important

- Blob is **not** production SSOT when database path succeeds.
- Sync tournament lifecycle still uses blob until callers migrate to async API.
- Production feature flags remain **OFF**.

Production migration: **NOT APPLIED**  
CC-03: **NOT STARTED**
