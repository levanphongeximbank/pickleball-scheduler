# S1-D — Rating V5 Seeding + Standings (Implementation Report)

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-D  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-301**, **S1-GAP-081**, **S1-GAP-076**, **S1-GAP-070**, **S1-GAP-071**.

---

## Deliverables

| Area | Implementation |
|------|----------------|
| Rating V5 seeding | Prefer `display_rating` + `reliability_score`; Elo/skill fallback; unseeded for new players |
| Seed bands | Configurable band size; attach labels for random draw within bands |
| Protected seeding | Manual override (permission-based) + seed audit log in engineV4 |
| Standings | Individual adapter → CC-08 STANDINGS_V2 canonical-primary when flags on |
| Tie-break | H2H (2-way) + mini-table (3+) via competition-core; explanation in UI |
| Qualification | Top-N marked `qualified` / `qualified_1st` / `eliminated` |
| Ranking hooks | `preparePostTournamentRatingHooks` stub — does **not** mutate Rating V5 |
| Organizer UI | EngineSeedTab preview/adjust; Official/Internal BXH + tie-break |
| Player UI | Seed + standings + qualification on registration page |

---

## Files (new)

| Path | Role |
|------|------|
| `src/features/individual-tournament/adapters/ratingV5SeedAdapter.js` | Consume Rating V5 snapshot for seed |
| `src/features/individual-tournament/adapters/individualStandingsAdapter.js` | STANDINGS_V2 bridge for individual |
| `src/components/tournament/PlayerSeedStandingsPanel.jsx` | Player seed/standings view |
| `tests/individual-tournament-seed-standings.test.js` | T-S1-D01–D05 |
| `docs/v5/qa-evidence/sprint-1-individual/S1D_SEED_STANDINGS_REPORT.json` | QA evidence |

## Files (wired)

| Path | Role |
|------|------|
| `src/features/tournament-engine/engines/seedEngine.js` | Prefer V5 display rating |
| `src/features/tournament-engine/services/tournamentEngineAdapter.js` | Enrich participants with V5 |
| `OfficialTournamentSetup.jsx` / `InternalTournamentSetup.jsx` | `buildIndividualAllGroupStandings` |
| `BracketResultsView.jsx` / `BracketGroupStandingsPanel.jsx` | Individual standings + tie-break copy |
| `EngineSeedTab.jsx` | Preview columns + protected adjust |
| `IndividualRegistrationPage.jsx` | Player seed/standings panel |
| `individual-tournament/index.js` | Public exports |

## Untouched (per rules)

- S1-A: `publishDrawEngine.js`, draw UI  
- S1-B core: `registrationEngine.js`  
- S1-C cores: fee/eligibility/regulations engines (consume helpers only)  
- Draw Engine (`drawEngine.js`)  
- Team tournament standings path  
- `src/features/pick-vn-rating-v5/**` calculation logic  

---

## Feature flags

`STANDINGS_V2` requires:

- `VITE_COMPETITION_CORE_ENABLED=true`
- `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED=true`

When off → legacy ranking sort with explanation label. Tests force canonical via adapter options.

---

## Tests

```
node --test tests/individual-tournament-seed-standings.test.js \
  tests/individual-tournament-eligibility.test.js \
  tests/individual-tournament-registration.test.js \
  tests/individual-tournament-draw-publish.test.js \
  tests/tournament-regression.test.js \
  tests/tournament-engine.test.js
# 47/47 PASS (incl. T-S1-D01–D05)
```

---

## Manual QA (owner)

| # | Step | Expected |
|---|------|----------|
| M1 | Engine tab → Tạo hạt giống with V5 profiles | Order by display_rating desc; Rating V5 column filled |
| M2 | Player without V5, with Elo | Seeded via Elo; source = Elo |
| M3 | Newbie (no matches) | Unseeded pool |
| M4 | BTC with reopen permission adjusts seed | Protected chip + audit entry |
| M5 | Group scores with STANDINGS_V2 flags on | Tie-break explanation shows STANDINGS_V2; H2H/mini-table order |
| M6 | Player registration page after seed/scores | Shows seed #, standing, qualification |

---

## Owner review gate

**Verdict requested:** Approve S1-D → proceed S1-E (schedule publish), or request changes.

**Not done (by design):** Deploy, merge, Rating V5 recalculation after tournament, Team Tournament changes.
