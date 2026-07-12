# TT-7 Preparation Report

**Track:** B1 — Standings QA  
**Branch:** `qa/team-tournament-pilot-preparation`  
**Date:** 2026-07-12  
**Production impact:** NONE

---

## Deliverables

| Artifact | Path | Status |
|----------|------|--------|
| QA plan | `TT7_STANDINGS_QA_PLAN.md` | ✅ |
| 4-team fixture | `fixtures/tt7-four-teams.json` | ✅ |
| 6-team fixture | `fixtures/tt7-six-teams.json` | ✅ |
| Expected (4-team) | `expected/tt7-four-teams-expected.json` | ✅ |
| Expected (6-team) | `expected/tt7-six-teams-expected.json` | ✅ |
| Oracle script | `scripts/qa/calculate-expected-team-standings.mjs` | ✅ |
| Oracle tests | `tests/qa/team-tournament-expected-standings.test.js` | ✅ |

## Validation

```bash
node --test tests/qa/team-tournament-expected-standings.test.js
```

All oracle tests pass on preparation branch.

## Scenario coverage

| Scenario | Fixture | Covered |
|----------|---------|---------|
| Two teams tied on wins | 4-team | ✅ (B/C at 2W) |
| Head-to-head decider | 4-team | ✅ (m-bc, headToHeadPriority profile) |
| Sub-match diff decider | 4-team | ✅ (default order) |
| Points scored decider | 4-team, 6-team | ✅ |
| Three-way tie | 6-team group 1 | ✅ |
| Technical forfeit | 6-team g2-de | ✅ |
| Withdrawn team | 6-team F | ✅ |
| Incomplete match | 6-team g2-ef | ✅ |
| Post-standings correction | correctionMatchups | ✅ (metadata) |
| DreamBreaker metadata | exhibitionMatchups xb-dc | ✅ |

## Engine parity

No comparison with `teamStandingsEngine.js` performed on this branch (by design). Mismatches during TT-7 execution must be logged as issues, not fixed here.

## Runtime changes

None.

---

## Verdict

**READY FOR TT-7 EXECUTION**

Owner review required before starting TT-7 on `feature/competition-core-standardization`.
