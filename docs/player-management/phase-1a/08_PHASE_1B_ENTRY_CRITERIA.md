# 08 — Phase 1B Entry Criteria

**Phase:** 1A → 1B gate  
**Status:** Official  

---

## Rule

Phase 1B (module skeleton `src/features/player/`) **may begin only when all criteria below are satisfied**.

---

## Entry checklist

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Canonical player identity contract documented | `02_CANONICAL_PLAYER_ID_CONTRACT.md` |
| 2 | Module ownership boundaries approved | `01_MODULE_BOUNDARIES.md` + Owner sign-off |
| 3 | Field dictionary complete | `03_PLAYER_PROFILE_FIELD_DICTIONARY.md` |
| 4 | Lifecycle model complete | `04_STATUS_AND_LIFECYCLE_MODEL.md` |
| 5 | Privacy contract complete | `05_PRIVACY_AND_PROFILE_VISIBILITY.md` |
| 6 | Legacy ID inventory complete | `06_LEGACY_ID_AND_DATA_SOURCE_INVENTORY.md` |
| 7 | No production behavior changed by Phase 1A | Diff limited to Phase 1A docs (+ validation report) |
| 8 | Tests and build show no regression **caused by Phase 1A** | `09_PHASE_1A_VALIDATION_REPORT.md` |
| 9 | Phase 1A audit/validation returns **PASS** or **PASS WITH DOCUMENTATION CONDITIONS** | Section verdict in `09_…` + Owner acceptance |

---

## Phase 1B scope reminder (not started in 1A)

When entry criteria pass, Phase 1B may:

- Create `src/features/player/` skeleton  
- Define repository interfaces / adapters over blob, profiles, athletes  
- Expose facade APIs such as `getPlayerProfile(playerId)` / `resolveByAuthUser(userId)`  

Phase 1B still must **not**:

- Move Club / Competition production modules wholesale  
- Apply DB migrations without a later dedicated phase  
- Change Competition Engine behavior  
- Rewrite rating / ranking algorithms  

---

## Owner approval block

| Field | Value |
|-------|--------|
| Owner name | _pending_ |
| Date | _pending_ |
| Decision | _pending_ — APPROVE 1B / REJECT / APPROVE WITH CONDITIONS |
| Conditions | _pending_ |

Phase 1B must not start on agent initiative alone without Owner decision recorded above (or equivalent written approval).
