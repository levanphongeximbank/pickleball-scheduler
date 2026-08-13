# official-open-sideout-runtime-01

**Workstream:** Official/Open Tournament Phase 2C — true Side-out runtime

**Status:** LOCAL PACKAGE ONLY — do **not** apply without explicit Owner GO.

## Problem

Classic Official referee path persists only `score_a` / `score_b` on
`public.tournament_match_live` and updates via
`referee_update_match_score` (Rally-style ±delta).

Traditional (Side-out) doubles scoring requires durable match-day state:

- scoring method
- serving side
- server number (1/2 where applicable)
- service transfer / side-out transition
- start + finalize semantics

Client-only Side-out against the current columns would be a fake implementation.

## Architecture decision

| Source | Role |
|--------|------|
| `src/features/competition-core/scoring` | Pure SIDE_OUT / RALLY progression (neutral domain) — **reuse after backend exists** |
| `src/features/referee-v5/engines/sideOutScoringEngine.js` | Rich court/player Side-out — Team/referee-v5 scoped; do **not** copy into Official in this batch |
| `tournament_match_live` + classic RPC | Official execution/read model today — **extend**, do not invent a second live table for Official |

`SIDEOUT_SHARED_EXTRACTION_RECONCILE_AFTER_PR418=NO` for this package path
(no Team #418 files modified). Official will wire competition-core progression
to extended live columns / RPC after apply.

## Intended schema (APPLY)

Add structured execution fields on `tournament_match_live` (names illustrative):

- `scoring_method text not null default 'rally'` — `rally` | `side_out`
- `serving_side text null` — `A` | `B`
- `server_number smallint null` — 1 | 2 for doubles Side-out
- `service_state jsonb not null default '{}'::jsonb` — optional extension bag
- keep `score_a` / `score_b` as score authority for display
- live remains execution model; final result still goes to canonical tournament result

Extend `referee_update_match_score` (or add sibling RPC) to:

1. Accept rally-outcome commands for Side-out (not blind +1 to either side)
2. Enforce serving-side point award + server transition using competition-core rules
3. Remain token-scoped / no anon broad write
4. Idempotent finalize path unchanged in spirit

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Column/RPC inventory (SELECT-only) |
| `02_APPLY.sql` | Columns + hardened RPC (Owner GO required) |
| `03_VERIFY.sql` | Contract checks; no fixture mutation |
| `04_ROLLBACK.sql` | Drop added columns / restore prior RPC body |
| `README.md` | This document |

## Product gate after apply

Only after Staging apply + app wiring:

- `SIDEOUT_OPERATIONAL=true`
- `SIDEOUT_DEFAULT_FOR_NEW_TOURNAMENT=true` (new Official defaults to Side-out)
- existing explicit Rally preserved
- legacy without explicit method: do not silently rewrite

## Safety

- Staging mutations: 0 in this workstream
- Production mutations: 0
- SQL applied: NO
- Do not merge PR #420 / #418 as part of this package authoring
