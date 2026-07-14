# S1-C — Eligibility + Fees + Config Pages (Implementation Report)

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-C  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-003**, **S1-GAP-007**, **S1-GAP-008**, **S1-GAP-009**, **S1-GAP-010**.

---

## Deliverables

| Area | Implementation |
|------|----------------|
| Eligibility | Age, gender, skill, rating range, club membership, invite-only, whitelist, max registrations / player |
| Fees | Free / fixed / early-bird / late; Unpaid / Paid / Refunded / Waived; organizer override; require-paid-to-approve |
| Config pages | Age, Gender(+policy), Fee, Regulations+messages — persist to individual tournament blob via `?tournamentId=` |
| Validation gate | `registrationValidation.js` wraps S1-B submit/approve **without editing** `registrationEngine.js` |
| Audit | `settings.eligibilityAuditLog` + identity `writeAuditLog` |
| Rating V5 | Consume display rating from player snapshot when present; flag-aware; **no edits** to `pick-vn-rating-v5/` |

---

## Files (new)

| Path | Role |
|------|------|
| `src/features/individual-tournament/engines/eligibilityEngine.js` | Rules + checks |
| `src/features/individual-tournament/engines/entryFeeEngine.js` | Fees + payments |
| `src/features/individual-tournament/engines/regulationsEngine.js` | Regulations + policy messages |
| `src/features/individual-tournament/engines/registrationValidation.js` | Gate wrappers |
| `src/features/individual-tournament/hooks/useIndividualTournamentConfig.js` | Config page loader |
| `src/components/tournament/IndividualTournamentSelector.jsx` | Tournament picker |
| `tests/individual-tournament-eligibility.test.js` | T-S1-C01–C05 |

## Files (wired UI)

| Path | Role |
|------|------|
| `src/pages/tournament/config/TournamentAgeRulesPage.jsx` | Blob persist |
| `.../TournamentGenderRulesPage.jsx` | Gender + invite/whitelist/rating/max |
| `.../TournamentFeePage.jsx` | Fee modes |
| `.../TournamentRegulationsPage.jsx` | Regulations + messages |
| `.../TournamentEligibilityPage.jsx` | Individual + team reports |
| `IndividualRegistrationPage.jsx` | Gated submit + fee summary |
| `RegistrationOpsPanel.jsx` | Gated approve + fee override |

## Untouched (per rules)

- S1-A: `publishDrawEngine.js`, `useTournamentEngine.js`, Draw UI  
- S1-B core: `registrationEngine.js` (gate wraps only)  
- Rating V5 module, Draw Engine, Team tournament engines  

---

## Tests

```
node --test tests/individual-tournament-eligibility.test.js \
  tests/individual-tournament-registration.test.js \
  tests/individual-tournament-draw-publish.test.js \
  tests/tournament-regression.test.js
# 26/26 PASS
```

---

## Manual QA (owner)

| # | Step | Expected |
|---|------|----------|
| M1 | Config Age + save with tournamentId | Persists `settings.eligibilityRules.age` |
| M2 | Underage player registers | Blocked with reason |
| M3 | Female → men_single | Blocked |
| M4 | Same player two events | Cross-event blocked |
| M5 | Fee requirePaid + unpaid approve | Blocked; waive override works |
| M6 | Regulations + confirmation message | Shown after register |

---

## Owner review gate

**Verdict requested:** Approve S1-C → proceed S1-D, or request changes.
