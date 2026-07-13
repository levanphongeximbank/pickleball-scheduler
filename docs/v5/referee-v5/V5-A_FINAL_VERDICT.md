# Referee V5-A / V5-B — Final Verdict

**Date:** 2026-07-12  
**Phase:** V5-A (Audit & Architecture) ✅ | V5-B (Domain engines) ✅ | V5-C (Court Visualizer prototype) ✅ | V5-D (Persistence draft) ✅  
**Feature flag:** `VITE_REFEREE_V5_ENABLED=false`

---

## 1. Criterion results

| Criterion | Result |
|-----------|--------|
| Current-state audit | **PASS** |
| Architecture | **PASS** |
| Court position model | **PASS** (design incl. diagonal serve/receiver) |
| Serve rotation model | **PASS** (design incl. người đỡ bóng) |
| Side switching model | **PASS** (design) |
| Side-out scoring design | **PASS** (design) |
| Rally scoring design | **PASS** (design) |
| Singles support | **PASS** (design) |
| Doubles support | **PASS** (design) |
| Team tournament support | **PASS** (design) |
| Event history | **PASS** (design) |
| Undo strategy | **PASS** (design) |
| Realtime strategy | **PASS** (design) |
| Offline strategy | **PASS** (design) |
| Security design | **PASS** (design) |
| Transactional finalization | **PASS** (design) |
| Rating V5 integration design | **PASS** (design) |
| Unit tests (V5-B mandatory) | **PASS** (35/35) |
| Unit tests (V5-D persistence) | **PASS** (50/50 in-memory) |
| Integration tests | **NOT RUN** |
| RLS tests | **NOT RUN** |
| Preview readiness | **NO** |
| Production readiness | **NO** |

---

## 2. Current maturity

| Dimension | Score /10 | Notes |
|-----------|----------:|-------|
| Visual court referee (V5 goal) | **5.0** | Persistence draft + 50 unit tests; no staging RPC |
| Legacy score entry | **5.6** | Per prior audit |
| Team sub-match scoring | **6.5** | Without positions |
| **Overall for V5 launch** | **5.0** | V5-D draft complete; staging apply pending |

---

## 3. Critical findings

### P0

| ID | Finding |
|----|---------|
| V5A-P0-01 | Zero player position / server / receiver in codebase or DB |
| V5A-P0-02 | +1 scoring incompatible with side-out rally semantics |
| V5A-P0-03 | No event store — cannot undo/rebuild visual state |
| V5A-P0-04 | ENDS_SWITCHED would require state model; CSS-only forbidden |
| V5A-P0-05 | No diagonal serve/receiver — cannot show ĐANG GIAO + ĐỠ BÓNG + arrow |

### P1

| ID | Finding |
|----|---------|
| V5A-P1-01 | Legacy token security insufficient for V5 production |
| V5A-P1-02 | No transactional finalize for official results |
| V5A-P1-03 | Realtime for referee is poll-only today |

### P2

| ID | Finding |
|----|---------|
| V5A-P2-01 | SCOREKEEPER / HEAD_REFEREE roles missing |
| V5A-P2-02 | Rally hints exist but not connected to position engine |

---

## 4. Recommended architecture

**Event-sourced match state** with:

- `match_events` + `match_live_states` (ADR-001, ADR-002)
- Pluggable rule engines for side-out vs rally (ADR-003)
- `NEAR_END` / `FAR_END` + `LEFT/RIGHT_SERVICE_COURT` (ADR-004, V5-B)
- Realtime snapshot + optional offline queue (ADR-005, V5-E)
- `referee_v5_finalize_match_result` transaction (ADR-006)
- Rating V5 hook at finalize only (§15 integration design)

**Module location:** `src/features/referee-v5/` behind `VITE_REFEREE_V5_ENABLED`

---

## 5. Rating V5 integration (design hook)

```text
referee_v5_finalize_match_result
  → INSERT match_result_revisions
  → IF rating_v5_enabled AND eligible AND NOT disputed:
       INSERT rating_evidence (source=official_match_result)
       → async rating_v5_process_match_evidence (V5-H)
  → idempotency_key links match_result ↔ rating_event
```

Referee module **never** writes `player_rating_profiles` directly.

Aligns with `docs/v5/rating-v5/V5-D_MATCH_ENGINE_SPECIFICATION.md` immutable events principle.

**Live integration:** NOT CONNECTED (Rating V5 flag off).

---

## 6. Phase roadmap

| Phase | Mục tiêu | Code dự kiến | SQL dự kiến | Test | GO |
|-------|----------|--------------|-------------|------|-----|
| **V5-A** | Audit + architecture | — | `PHASE_V5A_*.sql` DRAFT | — | ✅ Complete |
| **V5-B** | Match state + scoring engine | `engines/*` | — | Unit 35/35 ✅ | Engines PASS — owner review |
| **V5-C** | Court visualizer UI | `components/*`, `/dev/referee-v5` | — | UI 36/36 ✅ | Prototype PASS — owner visual review |
| **V5-D** | Event store + RPC + RLS | `persistence/*`, adapters, RPC stub | `PHASE_V5D_*.sql` DRAFT | Unit 50/50 ✅ | Draft complete — owner review |
| **V5-E** | Realtime + offline | hooks, queue | — | UI 7–10 | Multi-device demo |
| **V5-F** | Realtime + offline | hooks, queue | — | UI 7–10 | Multi-device demo |
| **V5-G** | Team tournament | TeamRefereePortal V5 | — | 18 | Sub-match E2E |
| **V5-H** | Rating V5 integration | evidence hook | — | 19–20 | Idempotent rating |
| **V5-I** | Staging QA → production | flags, runbook | production apply | Full suite | Owner GO |

---

## 7. Owner decisions required

1. Default scoring: **side-out** vs **rally** for club/internal tournaments?
2. Support multiple formats simultaneously per tournament?
3. Display labels: **Ô trái/phải** vs **Ô 1/Ô 2**?
4. Server 1/2 rules: strict USA Pickleball side-out or local variant?
5. End-switch triggers: which milestones per format?
6. Allow offline rally entry? (Recommended: **no** for v1)
7. Allow undo after game complete?
8. Two-sided result confirmation (captain sign-off)?
9. Event history as **sole** source of truth? (Recommended: **yes**)
10. Public live score from V5 state?
11. Scorekeeper role alongside referee?
12. HEAD_REFEREE approval for overrides?

---

## 8. Deliverables checklist (V5-A)

| File | Status |
|------|--------|
| `V5-A_CURRENT_STATE_AUDIT.md` | ✅ |
| `V5-A_ARCHITECTURE.md` | ✅ |
| `adr/ADR-001..006` | ✅ |
| `PHASE_V5A_REFEREE_FOUNDATION.sql` | ✅ DRAFT — NOT APPLIED |
| `V5-B_COURT_POSITION_SPECIFICATION.md` | ✅ (+ diagonal serve/receiver supplement) |
| `V5-C_MATCH_STATE_ENGINE_SPECIFICATION.md` | ✅ |
| `V5-D_REFEREE_UI_SPECIFICATION.md` | ✅ |
| `V5-E_REALTIME_OFFLINE_SPECIFICATION.md` | ✅ |
| `V5-A_SECURITY_VERIFICATION.md` | ✅ |
| `V5-F_TEST_PLAN.md` | ✅ |
| `V5-A_FINAL_VERDICT.md` | ✅ |
| `V5-B_IMPLEMENTATION_REPORT.md` | ✅ |
| `V5-B_MATCH_STATE_ENGINE.md` | ✅ |
| `V5-B_SERVE_ROTATION_ENGINE.md` | ✅ |
| `V5-B_RECEIVER_AND_DIAGONAL_MAPPING.md` | ✅ |
| `V5-B_TEST_RESULTS.md` | ✅ |

---

## 8b. V5-B deliverables

| Item | Status |
|------|--------|
| `src/features/referee-v5/` pure engines | ✅ |
| `tests/referee-v5/referee-v5-engine.test.js` | ✅ 35/35 |
| Legacy module unchanged | ✅ |
| SQL apply | **NOT APPLIED** |
| Preview / Production deploy | **NO** |

---

## 9. GO / NO-GO

| Gate | Verdict |
|------|---------|
| V5-A documentation complete | **GO** |
| V5-B domain engines + unit tests | **GO** |
| V5-C court visualizer prototype | **GO** |
| V5-D persistence draft | **GO** — owner review before staging apply |
| Preview deploy | **NO** |
| Production deploy | **NO** |
| SQL apply | **NOT APPLIED** |
| Legacy module changes | **NONE** |

---

## 10. Summary table

| Item | Value |
|------|-------|
| Recommended next phase | **Staging apply + Edge Function** (after owner GO) |
| Feature flag | `VITE_REFEREE_V5_ENABLED=false` |
| Migration | NOT APPLIED |
| Legacy impact | None (flag off) |

---

## 8c. V5-D deliverables

| Item | Status |
|------|--------|
| `persistence/RefereeV5PersistenceService.js` | ✅ |
| `adapters/LocalPrototypeAdapter.js` + `RemotePersistenceAdapter.js` | ✅ |
| `services/refereeV5RpcService.js` | ✅ |
| `tests/referee-v5/referee-v5-persistence.test.js` | ✅ 50/50 |
| `PHASE_V5D_REFEREE_PERSISTENCE.sql` | ✅ DRAFT — NOT APPLIED |
| V5-D documentation set | ✅ |
| Supabase integration / RLS | NOT RUN |
| Legacy module unchanged | ✅ |

---

*V5-D draft complete. Awaiting owner review before staging apply.*
