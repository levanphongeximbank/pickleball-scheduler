# S1-G — Walkover + Withdrawal + Third Place + Awards + Closing

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-G  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-072, 073, 074, 401** (and walkover workflow UX on top of S1-F types) for Individual Tournament only.

---

## Deliverables

| Area | Fix |
|------|-----|
| **Walkover** | `declareWalkover` — no-show / organizer WO → propagate winner + standings + audit `walkover_declared` |
| **Withdrawal** | before / during / injury + optional replacement; exclude from draw; during → WO remaining matches |
| **Third place** | Optional setting + auto-generate H3 from SF losers + medal wiring |
| **Awards** | Champion / runner-up / 3rd / 4th + optional fair-play & MVP; JSON/CSV export; certificates |
| **Closing** | Lock matches, freeze standings/brackets, auto-awards, summary, audit `tournament_closed` |

---

## Blob schema

```
settings.resultsOps.{ includeThirdPlace, walkovers[], auditLog[], closed, frozenStandings, frozenBrackets, summary }
settings.withdrawals[]
settings.awards.{ config, assignments, certificates }
entry.status = withdrawn (ENTRY_STATUS.WITHDRAWN)
```

**Audit:** `walkover_declared`, `withdrawal_requested`, `withdrawal_approved`, `award_assigned`, `tournament_closed`, `third_place_enabled`, `third_place_generated`

---

## Files changed

| File | Change |
|------|--------|
| `engines/walkoverEngine.js` | **NEW** |
| `engines/withdrawalEngine.js` | **NEW** |
| `engines/thirdPlaceEngine.js` | **NEW** |
| `engines/awardsEngine.js` | **NEW** |
| `engines/tournamentClosingEngine.js` | **NEW** |
| `individual-tournament/index.js` | Export S1-G APIs |
| `models/tournament/constants.js` | `ENTRY_STATUS.WITHDRAWN` |
| `models/tournament/entry.js` | `isWithdrawnEntry`; draw eligibility excludes withdrawn |
| UI panels (Walkover/Withdrawal/Third/Awards/Close/PlayerFinal) | **NEW** |
| `TournamentAwardsPage.jsx` | Real individual multi-tab hub |
| `TournamentWithdrawalPage.jsx` | Real individual loader |
| `IndividualRegistrationPage.jsx` | Player final results panel |
| `tests/individual-tournament-results-ops.test.js` | **NEW** T-S1-G01–G04 |
| Docs + QA JSON | This report |

## Untouched (per rules)

- S1-A…S1-F engine source files (S1-G **calls** S1-F `propagateMatchResult` only)
- Team tournament awards/withdrawal engines
- Rating V5 calculation
- Deploy / merge

---

## Automated test results

```bash
node --test \
  tests/individual-tournament-results-ops.test.js \
  … S1-A..F suites + tournament-engine + regression
# 72/72 PASS
```

---

## Manual QA checklist (owner)

| # | Step | Expected |
|---|------|----------|
| M1 | Trao giải page → Walkover → no-show | Winner advances; audit |
| M2 | Rút lui before event → duyệt | Entry `withdrawn`; excluded from draw filter |
| M3 | Rút lui injury mid-event | Remaining matches WO |
| M4 | Bật H3 → tạo trận | SF losers fill H3 |
| M5 | Auto gán giải + export CSV | Champion/2/3/4 + file |
| M6 | Đóng giải | Locked + frozen + summary |
| M7 | Player registration | Medal / certificate status |

---

## Out of scope

- S1-H UX polish / player mobile portal
- Knockout-only format (S1-GAP-402)
- Team tournament
- Production deploy / merge

---

## Owner review gate

**Verdict requested:** Approve S1-G → proceed S1-H (UX polish & QA), or request changes.
