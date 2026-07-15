# PHASE 45B.2 — Pairing Read Gateway (implementation)

**Status:** Authored modules + unit tests. **No caller migration. No flags. No SQL.**

## Module layout

`src/features/pairing-candidates/`

| File | Role | Portable? |
|---|---|---|
| `pairingCandidateReasonCodes.js` | Locked reason codes | Yes |
| `pairingCandidateContract.js` | Response builders + diagnostics shape | Yes |
| `pairingIdentityMapper.js` | `pairingIdentityId = athletes.id` | Yes |
| `pairingEligibilityEvaluator.js` | Ordered filters + optional rules seam | Yes |
| `canonicalAthleteRepository.js` | DI read join athletes + memberships | Adapter |
| `pairingCandidateService.js` | Public `listCandidates` | Thin |
| `index.js` | Barrel | — |

## Why a new repository (not extending canonicalPlayerRepository)

`canonicalPlayerRepository` keys pickers on `profiles.player_id` ↔ blob `playerId` and imports `loadPlayersForClub`. The pairing gateway must use **`athletes.id`** and **must never import blob storage**.

## Identity coverage

| Bucket | Meaning |
|---|---|
| mapped | athleteId + `profilePlayerId` alias |
| derived | athleteId + `legacyPlayerId` only |
| unmapped | athleteId with neither alias (still eligible) |

## Transfer boundary (second project)

Copy first: reason codes, contract, mapper, evaluator + their tests.  
Re-implement: repository injectables for that project's Supabase client.

## Next

45B.3 Identity repair · 45B.4 Diagnostics polish · 45B.5 Caller migration · 45B.6 Ownership lock
