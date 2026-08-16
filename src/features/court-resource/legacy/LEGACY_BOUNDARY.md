# Court Operations — explicit legacy compatibility boundary

```
LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT=YES
LEGACY_BOUNDARY_LOCATION=src/features/court-resource/legacy/
```

This folder is the **only** Court Operations entry for legacy Court
compatibility / migration / OFF-path runtime.

Canonical Court Operations modules **outside** this folder MUST NOT import:

- `domain/clubStorage`
- `loadCourtsForClub` / `loadBookingsForClub`
- `contracts/legacyCourtIdentityMapping` (except via this boundary)
- `club_data_v3` as Booking / inventory / capacity authority

## Allowed roles inside this boundary

| Role | Meaning |
| ---- | ------- |
| EXPLICIT_LEGACY_RUNTIME | Flag-gated OFF-path only |
| MIGRATION_ONLY | Dry-run / tooling — no Staging/Prod write from Batch 8 |
| UI_PROJECTION_ONLY | Display / compatibility fields — never SSOT |
| LEGACY_COMPATIBILITY | Temporary retain until cutover retirement |

## Forbidden

- Hidden fallback from canonical ON path into this boundary
- `tenantId \|\| venueId` invent
- Treating `court.status` / `currentMatchId` / Court Engine blob as Live Runtime SSOT
- Treating `bookingType=maintenance` as Resource Block SSOT
- D4 `court_resource_daily_play_acquire` on canonical Daily Play Adapter B path

See `LEGACY_RETIREMENT_MANIFEST.md` for item-level retirement status.
