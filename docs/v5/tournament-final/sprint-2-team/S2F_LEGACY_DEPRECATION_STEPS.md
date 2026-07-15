# S2-F — Legacy referee path deprecation steps

**Batch:** S2-F · **Date:** 2026-07-14  
**Policy:** Document only in this batch — **no Production SQL apply**

---

## Already in place (TT-5)

| Step | Status |
|------|--------|
| LEG-01 Legacy write locked when bridge linked | Done |
| LEG-02 Primary workspace `/referee/match/:matchId?tournamentId=` | Done |
| LEG-03 No Production TT-5 SQL without Owner GO | Policy (S2-F enforces) |

## Deferred (soft gaps)

| Step | Gap | When |
|------|-----|------|
| LEG-04 Remove legacy session fallback when V5 disabled | S2-GAP-051 / TT5 P1-4 | After Production go-live |
| LEG-05 Correction UX polish | S2-GAP-052 / TT5 P1-5 | Post-pilot polish |

## Operator reminder

1. Staging: use Referee V5 provision on published sub-matches.  
2. Production: do **not** apply TT-5B/C/D SQL until Owner issues Production GO.  
3. Feature flags: `VITE_REFEREE_V5_ENABLED`, `VITE_REFEREE_V5_DATA_MODE=remote`.
