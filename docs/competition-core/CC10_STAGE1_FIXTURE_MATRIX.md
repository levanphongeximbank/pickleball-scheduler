# CC-10 Stage 1 — Fixture Matrix

**Prefix:** `CC10-STAGE1-`  
**Isolation:** In-memory only; no Production users/clubs/tournaments.

## Entities (synthetic)

| Entity | IDs |
|---|---|
| Draw entries | `CC10-STAGE1-e1` … `e16` |
| Players | `CC10-STAGE1-p*` / `CC10-STAGE1-tp*` |
| Teams | `CC10-STAGE1-team-*` |
| Groups | `CC10-STAGE1-g1`, `CC10-STAGE1-h2h` |
| Matches | `CC10-STAGE1-m*`, `CC10-STAGE1-hm*` |
| Courts | `CC10-STAGE1-court-*` |

## 20-case matrix

| # | caseId | Module | Scenario |
|---|---|---|---|
| 1 | CC10-S1-01 | draw | Internal skill-controlled 8/2 |
| 2 | CC10-S1-02 | draw | Official open 12/3 |
| 3 | CC10-S1-03 | draw | Official AI balance 8/2 |
| 4 | CC10-S1-04 | draw | Team tournament 8/2 |
| 5 | CC10-S1-05 | formation | Standard pair 4 even |
| 6 | CC10-S1-06 | formation | Mixed 8 players |
| 7 | CC10-S1-07 | matchmaking | Daily balanced 8 |
| 8 | CC10-S1-08 | matchmaking | Odd overflow 10 |
| 9 | CC10-S1-09 | matchmaking | Repeat partner scoring |
| 10 | CC10-S1-10 | rules | Hard MUST_NOT_PARTNER |
| 11 | CC10-S1-11 | rules | Soft partner-repeat score |
| 12 | CC10-S1-12 | rules | Team lineup duplicate |
| 13 | CC10-S1-13 | rules | Same-club separation |
| 14 | CC10-S1-14 | standings | Simple group |
| 15 | CC10-S1-15 | standings | Two-entry H2H |
| 16 | CC10-S1-16 | standings | Three-entry mini-table |
| 17 | CC10-S1-17 | standings | Team forfeit |
| 18 | CC10-S1-18 | scheduling | Group-stage |
| 19 | CC10-S1-19 | scheduling | Round-robin BYE |
| 20 | CC10-S1-20 | scheduling | Team court/time |

**Runner:** `node scripts/verify-cc10-stage1-shadow-matrix.mjs`  
**Evidence:** `docs/competition-core/qa-evidence/phase-cc10-stage1/CC10_STAGE1_SHADOW_MATRIX_REPORT.json`

## Cleanup plan

Fixtures exist only in script memory and JSON report. No Supabase writes. No cleanup required beyond preserving evidence artifacts (no secrets).
