# 03 — Persistence Decision

## Inspection summary

| Store | Usable for Phase 1C foundation fields? |
|-------|----------------------------------------|
| `profiles` | `birth_year` yes; no `birth_date` / handedness / region / privacy / identity verification |
| `athletes` | No demographics columns; not preferred |
| Blob `players[]` | Legacy operational — not new SSOT |
| New localStorage key | **Forbidden** |

## Decision

1. **Write contract + validation** implemented in Player Management.  
2. **Repository interface** with:
   - `createUnconfiguredPlayerProfileWriteRepository` — **default**; returns `PERSISTENCE_NOT_CONFIGURED` (no silent durable success)  
   - `createMemoryPlayerProfileWriteRepository` — tests / explicitly injected non-production only (`durable: false`)  
   - `createPhase1cPlayerProfileWriteRepository` — optional Identity `birthYear` writer; gap fields fail with `SCHEMA_MIGRATION_REQUIRED`  
3. **No SQL migration created or applied** in this task.  
4. Prefer future additive columns on `profiles` (same person row — not a second identity store), wired through Identity-compatible writers under Player ownership of the field contract.

## Reused services

- Phase 1B `resolveCanonicalPlayerId` / resolution outcomes  
- Existing `normalizeAthleteGender` via gender adapter  
- Optional future: Identity `updateSelfProfile` for `birth_year` only when an `identityBirthYearWriter` is injected  

## Not reused as person SSOT

- Rating verification tables/enums  
- Ranking mock region data  
- Venue customers  
