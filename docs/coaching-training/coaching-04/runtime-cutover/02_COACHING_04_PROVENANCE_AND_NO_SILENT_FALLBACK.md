# COACHING-04 — Provenance & No Silent Fallback

## Provenance states

| State | Meaning |
|-------|---------|
| `LOADING` | In-flight list |
| `LIVE` | Durable success with ≥1 row |
| `EMPTY` | Durable success with 0 rows (not an error) |
| `UNMAPPED` | PLAYER self-scope mapping missing — fail-closed |
| `FORBIDDEN` | Authorization denied |
| `ERROR` | Durable unavailable / resolver failure |

Hook: `useCoachingCollection` exposes `provenance` + `status` (`unmapped` / `denied` / `error` / `empty` / `ready`).

## Telemetry (`__COACHING_LEGACY_TELEMETRY__`)

| Event | When |
|-------|------|
| `legacy_read` / `legacy_write` | Explicit legacy mode |
| `silent_fallback_blocked` | Durable failure — **never** switches to legacy success |

Contract: `getCoachingLegacyIsolationContract().silentSuccessOnDurableFailure === false`.

## localStorage paths (exact)

| Op | Path |
|----|------|
| Key | `pickleball-coaching-v1::{clubId}` |
| Read/write SoT | `src/features/coaching/services/coachingService.js` |
| Runtime importer | `createLegacyCoachingAdapter.js` only |
| Detect only | `localStorageRetirement.js` (`detectLegacyStore`) |
| Durable adapter | never imports `coachingService` / never touches localStorage |

## Fallback rule

Durable mode failure → ERROR/FORBIDDEN/UNMAPPED surface. No silent localStorage success.
