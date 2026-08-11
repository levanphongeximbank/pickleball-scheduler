# team-tournament-dreambreaker-referee-start-canonical-01

**Workstream:** `TEAM-TOURNAMENT-PR412-DREAMBREAKER-REFEREE-START-CANONICAL-REMEDIATION-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Referee READY UI is correct (2-2, both captain orders submitted). Start fails with `VALIDATION` / `Thiếu nội dung Dreambreaker.` because `team_tournament_start_dreambreaker` required a `team_tournament_disciplines` row matching `%dreambreaker%` or `activation_rule='dreambreaker'`.

Live READY fixture `team-tournament-4zllu71z` / `matchup-ilj0220c` has only four `always`/`doubles` rows. Canonical MLP `activationRule` is `tie_at_2_2`. Client start also omitted `dreambreaker.version`.

## Client pairing

`TeamRefereePortal.handleDreambreakerStart` → `buildRefereeDreambreakerStartCommand` → `expectedVersion = matchup.dreambreaker.version`

- no client order resubmission
- local `startDreambreaker` uses persisted orders + synthetic discipline id `dreambreaker` when catalog is missing
- MLP create/ensure persists exactly one Dreambreaker catalog row (`id=dreambreaker`, `disciplineKind=dreambreaker`, `activationRule=tie_at_2_2`)

## Server contract (this package)

| Check | Behavior |
|-------|----------|
| Orders | Read persisted `team_a_order` / `team_b_order` only |
| Matcher | `discipline_kind=dreambreaker` → `activation_rule=tie_at_2_2` → legacy `activation_rule=dreambreaker` → name/id/kind like `%dreambreaker%` |
| Missing catalog | READY + 4/4 still starts with synthetic `discipline_external_id='dreambreaker'` |
| CAS | `dreambreaker_states.version` required; stale → conflict before UPDATE |
| Submatch | Insert only when `external_sub_match_id` is absent |
| Replay | `begin_command` replay unchanged |

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Unique signature; no `tie_at_2_2`; READY fixture 4/4; catalog row absent |
| `02_APPLY.sql` | Harden start RPC only |
| `03_VERIFY.sql` | Matcher, synthetic start, CAS, grants; no fixture mutation |
| `04_ROLLBACK.sql` | Restore prior start RPC body only |

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `bcfeacc3996ab8c94b6ae4fae43d70f75259fba2a2cad59c6f70885ea8db50aa` |
| `02_APPLY.sql` | `c43f6849e1a1d75ae8406cf0e207389eb1f7f7467945ca3ddda343d3340978e8` |
| `03_VERIFY.sql` | `307a2c9ca81af7039a7484c28d2618caaf2c4c4b023d4944be8f7c4dc7d79fdb` |
| `04_ROLLBACK.sql` | `362a1ccf60687f6a96079445fca4ba7331457305fc8a45cb4b17f397d8f71b7d` |

Do not apply this package without Owner GO. Zero Staging/Production mutations in this workstream.
