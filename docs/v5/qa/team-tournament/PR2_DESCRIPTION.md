# PR #2 — Suggested description (paste manually)

**PR:** https://github.com/levanphongeximbank/pickleball-scheduler/pull/2  
**Branch:** `qa/team-tournament-pilot-preparation` → `feature/competition-core-standardization`  
**Status:** Draft — QA preparation only  
**Production impact:** NONE

---

## Summary

Parallel QA preparation for Team Tournament pilot phases **TT-7, TT-9, TT-10, TT-11** on an isolated branch/worktree. This PR adds fixtures, oracles, validators, checklists, and report templates. It does **not** change production runtime, deploy SQL, or start pilot execution.

## Base / head

| | Branch | Purpose |
|---|--------|---------|
| **Base** | `feature/competition-core-standardization` | Competition Core integration line |
| **Head** | `qa/team-tournament-pilot-preparation` | QA-only artifacts |

## Scope

| Track | Phase | Deliverables |
|-------|-------|--------------|
| B1 | TT-7 | Standings fixtures, independent oracle, deep-compare tests |
| B2 | TT-9 | Mobile QA plan + device checklists + report templates |
| B3 | TT-10 | Pilot dry-run dataset, 15-step scenarios, validator, CSV fallback |
| B4 | TT-11 | Release readiness templates (GO/NO-GO, backup, rollback, incidents) |

## Validation

```powershell
node --test tests/qa/team-tournament-expected-standings.test.js
node --test tests/qa/validate-tt10-pilot-fixture.test.js
node scripts/qa/validate-tt10-pilot-fixture.mjs
npm test
```

Expected:

- TT-7 oracle tests PASS (full standings deep-compare, not rank-only)
- TT-10 validator tests PASS (12 negative/positive cases)
- `validate-tt10-pilot-fixture.mjs` returns `ok: true`
- Full unit suite PASS

## Explicit exclusions

- No production deployment
- No Supabase SQL apply
- No mobile UI changes
- No TT-7/TT-9/TT-10/TT-11 **execution** on this branch
- No merge to main without owner GO after review gate

## Review findings addressed

| ID | Finding | Fix |
|----|---------|-----|
| P1-01 | TT-7 tests rank-only | Deep-compare all standings metrics via `standings-compare-helpers.mjs` |
| P1-02 | TT-10 validator shallow | Expanded lineup, eligibility, scenario, CSV sync, terminal-path checks |
| P1-03 | S14 blocked (m-ad, m-bc pending) | Scenarios S12–S13 confirm all 6 matchups terminal before S14 |
| P2-01 | Report template missing S02–S15 | `TT10_DRY_RUN_REPORT.json` has 15 `not_run` entries |
| P2-02 | TT-9 iPhone multi-session | Independent session rules (no dual Safari tabs) |
| P2-03 | PR description empty | This file for owner manual paste |

## Merge policy

- Remains **Draft** until owner converts after re-review gate PASS
- No auto-merge
- No force push
- Owner merges when TT-2E + QA prep are both approved

## Deployment status

| Environment | Status |
|-------------|--------|
| Vercel Preview | Auto-build on push (QA branch) |
| Vercel Production | NONE |
| Supabase Production | NONE |

## Production impact

**NONE** — documentation, fixtures, scripts, and tests only under `docs/v5/qa/team-tournament/`, `scripts/qa/`, `tests/qa/`.
