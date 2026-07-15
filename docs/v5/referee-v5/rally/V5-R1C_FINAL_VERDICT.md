# REFEREE V5-R1C — Final Verdict

**Phase:** R1-C — Architecture & Rules Spec  
**Date:** 2026-07-13  
**Project:** REFEREE V5-R (Rally Scoring)  
**Authority:** Owner Review 2026-07-13 (`V5-R1_OWNER_DECISIONS.md`)

---

## REFEREE V5-R1C: COMPLETE

### Repository

- **Name:** `pickleball-scheduler-referee-v5-rally`
- **Branch:** `feature/referee-v5-rally-scoring`
- **Phase delivered:** R1-C documentation pack only

---

## Owner decisions incorporated

| # | Decision | R1-C artifact |
|---|----------|---------------|
| 1 | USAP 2026 Rally — first profile | Contract §3, Strategy Design §5 |
| 2 | Default 11 / win by 2; arch supports 15/21 | Contract §3–4 |
| 3 | Early best-of termination | Contract §4, TT Integration §6 |
| 4 | Doubles only R2 | ADR-R-005, Roadmap §2 |
| 5 | DreamBreaker out of R2 | ADR-R-005, Owner §5 |
| 6 | freezeRule = NONE | Contract, Strategy Design |
| 7 | Strategy + Registry; no silent fallback | Strategy Design §2–3 |
| 8 | Canonical profile JSON | Owner §8, Contract §3 |
| 9 | Legacy explicit replay | Contract §7 |
| 10 | Migration deferred | ADR-R-006 |
| 11 | TT chooses format; V5 executes; official only | TT Integration §1–5 |

---

## Architecture verdict

| Component | R1-C decision |
|-----------|---------------|
| Pattern | **ScoringStrategy + Registry** |
| Shared core | Lifecycle, persistence, undo/replay, realtime, finalize |
| Side-Out | Frozen behavior — wrapper only in R2 |
| Rally | New `Usap2026ProvisionalRallyDoublesStrategy` — **not** prototype |
| Anti-patterns | Scattered `if/else`; silent Rally→Side-Out fallback |
| DreamBreaker / MLP | Future separate strategies |

---

## Match format contract

**First profile:**

```json
{
  "scoringSystem": "RALLY",
  "scoringVariant": "USAP_2026_PROVISIONAL_RALLY",
  "pointsToWin": 11,
  "winBy": 2,
  "freezeRule": "NONE",
  "serverNumberRule": "NONE",
  "supportedMatchType": "DOUBLES"
}
```

- Immutable after match start (ADR-R-004).
- New matches require `scoringSystem` + `scoringVariant`.
- Legacy side-out: explicit replay profile.

---

## Team Tournament

- TT provisions format → V5 executes → TT receives official result only.
- Standings format-agnostic.
- **P0-06** provision mapping documented — fix required in R2 WP-5.

---

## Migration

| Item | Status |
|------|--------|
| SQL apply | **NOT APPLIED** |
| Decision | **DEFERRED** (ADR-R-006) |
| R2 assumption | JSON state extension sufficient until audit |

---

## R2 readiness

### **YES**

R1-A + R1-B + Owner Review + R1-C spec pack complete. R2 may begin on **separate GO** — not in R1-C turn.

### Remaining P0 (resolve in R2)

| ID | Item |
|----|------|
| P0-01 | Side-out regression on shared modules |
| P0-04 | Replay wrong engine if format missing |
| P0-06 | TT `scoringSystem` → V5 state mapping |
| P0-02/03 | Replace rally prototype (wrong server/position) |
| P0-05 | Rally finalize / official result correctness |
| P0-07 | Double-count if provision wrong |

### Remaining P1 (R2 / early)

| ID | Item |
|----|------|
| P1-02 | Formalize registry (planned WP-1) |
| P1-03 | UI server 1/2 hide for rally |
| P1-05 | ≥25 rally tests (currently 0) |
| P1-07 | Side-switch milestone wiring |
| P1-08 | GAME_COMPLETED lock enforcement |
| P1-01 | `ruleSetId` optional field |

### Resolved by owner (no longer open)

| Former open item | Resolution |
|------------------|------------|
| Default 21 vs 11 | **11** approved |
| DreamBreaker in rally scope | **Out** |
| Freeze in R2 | **NONE** |
| Migration never needed | **Deferred**, not ruled out |
| Singles in R2 | **Deferred** |

---

## Documents created / updated (R1-C)

| File | Action |
|------|--------|
| `V5-R1_OWNER_DECISIONS.md` | **Created** |
| `V5-R1C_FINAL_VERDICT.md` | **Created** |
| `V5-R1C_IMPLEMENTATION_ROADMAP.md` | **Created** |
| `V5-R1C_MATCH_FORMAT_CONTRACT.md` | **Created** |
| `V5-R1C_RALLY_STRATEGY_DESIGN.md` | **Created** |
| `V5-R1C_TEAM_TOURNAMENT_INTEGRATION.md` | **Created** |
| `adr/ADR-004-MATCH-FORMAT-IMMUTABILITY.md` | **Created** |
| `adr/ADR-005-FIRST-RALLY-SCOPE.md` | **Created** |
| `adr/ADR-006-MIGRATION-DECISION-DEFERRED.md` | **Created** |

Prior R1-A / R1-B docs remain valid; owner overrides R1-A default **21** → **11** where they conflict.

---

## Code changes

**DOCUMENTATION ONLY**

## SQL

**NOT APPLIED**

## Deployment

**NOT PERFORMED**

## Production

**UNTOUCHED**

---

## Next phase

**R2** per `V5-R1C_IMPLEMENTATION_ROADMAP.md` — await explicit GO. Do not start in same turn as R1-C closeout.

**End of REFEREE V5-R1C**
