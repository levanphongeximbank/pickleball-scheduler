# PHASE 45B.3 — Athlete Identity Mapping Repair

**Status:** Pairing-infrastructure identity repair + unit tests. **No UI change. No caller migration. No SQL. No flags.**

## Canonical identity (locked)

| Field | Role |
|---|---|
| `athletes.id` | **ONLY** pairing identity (`pairingIdentityId`) |
| `athletes.user_id` | Account identity |
| `profiles.player_id` | Legacy alias only |
| blob / local `player.id` | Legacy alias only |

## What changed

- `pairingIdentityMapper.js` — repair: extract athlete id strictly from `athleteId`/`athlete_id`; collect legacy aliases; diagnose mismatches/duplicates; `athletes.id` always wins over conflicting `pairingIdentityId`/`id`/`playerId` claims; never silent-drop when aliases missing.
- `canonicalAthleteRepository.js` — never promotes `player_id` / blob id into `athleteId`.
- `pairingCandidateService.js` — surfaces `diagnostics.aliasDiagnostics` + identity warnings.
- Gateway version → `45B.3.0`.

## Audit (still legacy-primary outside pairing infra — callers out of scope)

| Area | Primary key today | Status |
|---|---|---|
| `pairing-candidates/*` | `athletes.id` | **Repaired** |
| `SelectPlayers` (45B.5A) | adapter → gateway | Uses gateway |
| `canonicalPlayerRepository` / picker adapters | `profiles.player_id` ↔ blob | Legacy (caller migration later) |
| Private pairing picker / simulation | MAPPED/DERIVED drop UNMAPPED | Out of scope |
| Daily / Team / Tournament loaders | blob / aware pool | Out of scope |

## Next

45B.4 Diagnostics polish · remaining 45B.5 caller migration · 45B.6 Ownership lock
