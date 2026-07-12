# V5-B.1P — Canonical Server Runtime Final Verdict

**Phase:** V5-B.1P — Canonical Server Runtime, Scoring Parity, Live Staging Contract  
**Date:** 2026-07-12  
**Staging project:** `qyewbxjsiiyufanzcjcq`  
**Version freeze:** `v5.0f`  
**Branch commit:** local working tree (not committed)

---

## Executive summary

Single canonical V5 scoring path is implemented: **full JS gate-weighted engine in trusted server runtime** → **persistence-only SQL RPC (service_role)**. Mean-scoring prototype RPC is renamed and revoked from `authenticated`. Live staging contract **20/20 PASS**. Ready for V5-B.2 UI wiring review — **NO** (Edge Function deploy + owner approval still required).

---

## Verdict matrix

| Gate | Result |
|------|--------|
| TRUSTED SERVER RUNTIME | **PASS** |
| SINGLE CANONICAL SCORING PATH | **PASS** |
| JS/SQL SPLIT-BRAIN REMOVED | **PASS** |
| FULL V5 SCORING ON SERVER | **PASS** |
| GOLDEN-VECTOR PARITY | **PASS** |
| LIVE STAGING CONTRACT | **PASS** (20/20) |
| TRANSACTION ATOMICITY | **PASS** (5/5 rollback) |
| DATABASE IDEMPOTENCY | **PASS** |
| DIRECT RPC BYPASS PROTECTION | **PASS** |
| VERSION STAMPING | **PASS** |
| APPEND-ONLY EVENT | **PASS** |
| V2 RUNTIME ISOLATION | **PASS** |
| **READY FOR V5-B.2 UI WIRING** | **NO** |
| **READY FOR SHADOW PILOT** | **NO** |
| **READY FOR PRODUCTION** | **NO** |
| **OWNER APPROVAL REQUIRED** | **YES** |

---

## Trusted runtime architecture

```text
Client answers (no scores)
  → trustedCompleteAssessment / Edge Function rating-v5-complete-assessment
  → validateCompleteAssessmentPayload
  → scoreAssessmentForPersistence (full V5 JS engine)
  → rating_v5_service_persist_assessment_completion (service_role only)
  → transaction commit
  → canonical response (7 version fields + scores)
```

| Component | Path | Browser bundle? |
|-----------|------|-----------------|
| Scoring SSOT | `src/features/pick-vn-rating-v5/server/scoreAssessmentCompletion.js` | **NO** — not exported from `index.js` |
| Orchestrator | `src/features/pick-vn-rating-v5/server/trustedCompleteAssessment.js` | **NO** |
| Edge HTTP | `src/features/pick-vn-rating-v5/server/edgeEntry.js` | **NO** |
| Edge deploy | `supabase/functions/rating-v5-complete-assessment/index.ts` | Deno runtime |
| Persistence | `rating_v5_service_persist_assessment_completion` | SQL service_role only |
| Prototype (diagnostic) | `rating_v5_prototype_mean_complete_assessment` | service_role only — **NOT canonical** |

Shared pure engine modules (no duplicate copy):

- `assessment/assessmentScoringEngine.js`
- `assessment/criticalGates.js`
- `constants/derivedMetrics.js`
- `constants/versions.js` (+ `server/activeVersionContract.js`)

---

## SQL applied (staging)

- File: `docs/v5/rating-v5/PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql`
- Migrations: `phase_v5b1p_persistence_and_edge`, `phase_v5b1p_fix_service_role_assert`
- Changes:
  - Added `rating_v5_service_persist_assessment_completion` (persistence-only)
  - Renamed `rating_v5_complete_assessment` → `rating_v5_prototype_mean_complete_assessment`
  - Revoked `authenticated` execute on prototype
  - Strengthened idempotency index `player_rating_events_assessment_complete_idempotent_idx`
  - Service role detection via `auth.jwt()` + JWT claim fallbacks

---

## Test report

| Suite | Result | Evidence |
|-------|--------|----------|
| **UNIT** | **60/60 PASS** | `node --test tests/pick-vn-rating-v5-*.test.js` |
| **GOLDEN VECTOR** | **34 vectors PASS** | `docs/v5/rating-v5/golden-vectors/V5_GOLDEN_VECTORS.json` |
| **LIVE STAGING** | **20/20 PASS** | `docs/v5/rating-v5/qa-evidence/v5-b1p-live-staging/LIVE_STAGING_REPORT.json` |
| **JWT RLS** | **14/14 PASS** | `docs/v5/rating-v5/V5-A3_JWT_RLS_RUNTIME_RESULTS.md` (re-run 2026-07-12) |
| **ROLLBACK** | **5/5 PASS** | `docs/v5/rating-v5/qa-evidence/v5-b1p-rollback/ROLLBACK_REPORT.json` |
| **CONCURRENCY** | **PASS** | ls16 — dual parallel complete, single event |
| **V5 LINT** | **0 errors** | `scripts/lint-v5-scoped.mjs` |
| **BUILD** | **PASS** | `npm run build` |

---

## Live staging scenarios (20/20)

1. User A self-complete ✅  
2. User A cannot complete User B ✅  
3. Cross-tenant blocked ✅  
4. Invalid question blocked ✅  
5. Invalid anchor blocked ✅  
6. Forbidden verified_rating blocked ✅  
7. Forbidden domain_scores blocked ✅  
8. Golden vector p09 parity ✅  
9. Version stamping (7 fields) ✅  
10. Append-only event created ✅  
11. Shadow profile updated ✅  
12. V2 unchanged ✅  
13. Estimated >4.5 capped provisional 4.5 ✅  
14. Singles → SINGLES_NOT_IMPLEMENTED ✅  
15. Idempotent retry ✅  
16. Concurrent — no duplicate event ✅  
17. Completed assessment immutable ✅  
18. Direct persistence RPC from PLAYER denied ✅  
19. Mean prototype cannot create canonical (authenticated revoked) ✅  
20. Response matches DB ✅  

---

## Blockers before V5-B.2 UI wiring

1. **Deploy Edge Function** `rating-v5-complete-assessment` to staging (`node scripts/bundle-rating-v5-edge-shared.mjs` then `supabase functions deploy`).
2. **Owner approval** after reviewing this verdict.
3. **Do not** enable V5 feature flag for real users until shadow pilot plan approved.

---

## Explicit non-goals (unchanged)

- No Production deploy
- V2 remains canonical (`pick_vn_player_ratings`)
- No UI wiring in this phase
- No singles / match engine
- No shadow pilot for real users yet
