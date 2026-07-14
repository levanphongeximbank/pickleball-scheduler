# Sprint 1 — Individual Tournament Final Report

**Project:** Tournament V5 · Sprint 1  
**Date:** 2026-07-14  
**Status:** ✅ Batches S1-A → S1-H implemented — **STOP FOR OWNER REVIEW**  
**Deploy:** ❌ Not deployed · **Merge:** ❌ Not merged

---

## Sprint goal (recap)

Hoàn thiện giải cá nhân (`internal_tournament`, `official_tournament`) lên Sprint 1 Definition of Done cho **staging pilot**.

---

## Batch completion

| Batch | Focus | Status |
|-------|--------|--------|
| **S1-A** | Engine wiring + draw publish | ✅ |
| **S1-B** | Registration lifecycle | ✅ |
| **S1-C** | Eligibility + fees + config | ✅ |
| **S1-D** | Rating V5 seed + STANDINGS_V2 | ✅ |
| **S1-E** | Schedule publish + min rest | ✅ |
| **S1-F** | Referee + result propagation | ✅ |
| **S1-G** | Walkover / withdrawal / H3 / awards / close | ✅ |
| **S1-H** | Player portal + UX + final QA | ✅ |

---

## Architecture (pilot)

```
Club blob SSOT
 ├── settings.draw / schedule / refereeAssignments / matchResults
 ├── settings.resultPropagation / resultCorrections / resultsOps
 ├── settings.awards / withdrawals / playerNotifications
 └── events[].matches / bracket / entries

Player portal  → reads blob (+ soft poll)
Organizer pages → mutate blob via engines
Classic referee → /referee/:token
```

Cloud SQL / TT5 outbox RPC parity = deferred (blob-first pilot, same as S1-A…G).

---

## Automated QA summary

| Suite | Result |
|-------|--------|
| S1-A…H individual + tournament-engine + regression + v5-menu-audit | **86/86 PASS** |

Evidence JSON:

- `docs/v5/qa-evidence/sprint-1-individual/S1A_*` … `S1H_*`
- `S1_SPRINT1_FINAL_QA_REPORT.json` (this closure)

---

## Remaining known P2 / out of Sprint 1

| Item | Note |
|------|------|
| S1-GAP-001 cloud SSOT | Optional; blob pilot OK |
| S1-GAP-062 Referee V5 individual | Classic token path for pilot |
| S1-GAP-080 Rating V5 singles | Doubles pilot waiver |
| S1-GAP-402 Knockout-only format | Deferred |
| S1-GAP-090 BTC mobile parity | Partial; portal exists for players |
| Production deploy | Explicitly out of scope |

---

## Owner sign-off checklist

- [ ] Staging smoke M1–M26 (`S1_INDIVIDUAL_TEST_PLAN.md`)
- [ ] Player portal `/tournament/my` with enrolled account
- [ ] Organizer journey draw → schedule → referee → result → awards → close
- [ ] Approve Sprint 1 Individual for staging pilot
- [ ] Decide merge branch strategy (no force-push main)

---

## Verdict requested

**Approve Sprint 1 Individual (S1-A…H) for staging pilot**, or request remediation batch.
