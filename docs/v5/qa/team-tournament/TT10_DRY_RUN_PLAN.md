# TT-10 — Dry Run Plan (4-team CLB pilot)

**Phase:** TT-10 preparation (Track B3)  
**Branch:** `qa/team-tournament-pilot-preparation`  
**Production impact:** NONE

---

## 1. Objective

Provide a complete fixture dataset for a 4-team club dry-run covering lineup, lock, publish, referee, forfeit, standings, correction, and export.

## 2. Dataset summary

| Item | Count |
|------|-------|
| Teams | 4 (A, B, C, D) |
| Players per team | 5–6 (min 2M + 2F each) |
| Captains | 4 |
| Referees | 2 |
| Courts | 3 |
| Matchups | 6 (round-robin) |
| Disciplines | 4 (MD, WD, MX1, MX2) |
| DreamBreaker | Disabled (pilot default) |

## 3. Fixture files

| File | Purpose |
|------|---------|
| `fixtures/tt10-pilot-tournament.json` | Tournament, teams, players, courts, schedule |
| `fixtures/tt10-users.json` | Role account metadata (no real users) |
| `fixtures/tt10-scenarios.json` | 15-step dry-run script |

## 4. Manual fallback (CSV)

Located in `fallback/` — use if cloud export unavailable:

- `teams.csv`, `players.csv`, `schedule.csv`, `lineups.csv`, `results.csv`, `standings.csv`

## 5. Validation

```bash
node scripts/qa/validate-tt10-pilot-fixture.mjs
```

Checks: unique IDs, roster size/gender, captain/referee mapping, court conflicts, required settings.

## 6. Dry-run execution (future — main branch)

Follow `tt10-scenarios.json` steps S01–S15 on staging with owner-approved test accounts mapped from `tt10-users.json`.

## 7. Rules

- No SQL apply on QA branch
- No Production access
- No runtime code changes
- Map `emailPlaceholder` to staging users during execution only

---

**Verdict (prep):** Dataset ready for owner mapping to staging accounts
