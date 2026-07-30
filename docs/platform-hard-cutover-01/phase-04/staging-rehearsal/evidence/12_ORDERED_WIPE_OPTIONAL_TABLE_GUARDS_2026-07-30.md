# Ordered Wipe — optional-table guards (schema drift)

**Marker:** `PLATFORM_HARD_CUTOVER_01_ORDERED_WIPE_OPTIONAL_TABLE_GUARDS_2026-07-30`  
**Fresh main:** `5f187d0566070723320ea23c819decec0d35ff51`  
**Prior fail:** `42P01 public.vpr_point_ledger` — full rollback; DB net mutations = 0

## Classification (exact 10)

| Table | Kind | Source | Reseed dep | FK vs present-82 |
|-------|------|--------|------------|------------------|
| `_phase19b_test_accounts` | legacy/test | phase19b (not on Staging) | no | none |
| `ai_workflow_checklists` | business optional | `docs/v5/PHASE_AI_V52_PHASE5.sql` | no | none |
| `court_claim_requests` | business optional | `docs/v5/PHASE_33_COURT_CLAIM_REQUESTS.sql` | no | none |
| `tournament_certifications` | VPR optional | `docs/v5/PHASE_29_RANKING.sql` | no | none |
| `vpr_*` (6 tables) | VPR optional | `docs/v5/PHASE_29_RANKING.sql` | no | none |

## Package change

- Logical manifest remains **92**
- Required static wipe: **82** present Staging tables
- Optional: exact **10** `to_regclass('public.<literal>')` + `EXECUTE 'TRUNCATE TABLE public.<literal>'`
- No CREATE / DROP / CASCADE / scope expansion
- `30_POST_WIPE_VERIFY.sql`: optional absent OK; present ⇒ count must be 0

## Not run

wipe re-run · DROP · reseed · Restore · Production mutations
