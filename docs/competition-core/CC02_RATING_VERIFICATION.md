# CC-02 — Rating Verification

**Phase:** CC-02 | **Date:** 2026-07-11

---

## 1. Unit tests

| File | Cases | Focus |
|------|-------|-------|
| `competition-core-rating-mapping.test.js` | 5 | map v1, clamp, confidence |
| `competition-core-rating-eligibility.test.js` | 7 | BYE, void, daily play, forfeit |
| `competition-core-rating-kfactor.test.js` | 3 | K tiers 40/32/20 |
| `competition-core-rating-v2-engine.test.js` | 6 | V2 apply, flag gate, monthly review |
| `competition-core-legacy-adapter.test.js` | +1 | rating v2 available |

---

## 2. Commands

```bash
node --test tests/competition-core-rating-*.test.js
npm test
npm run build
npx eslint src/features/competition-core/rating tests/competition-core-rating-*.test.js
```

---

## 3. SQL verification (after staging apply)

```sql
select count(*) as player_ratings_count from public.player_ratings;
select rating_status, count(*) from public.player_ratings group by 1 order by 1;
select count(*) from public.rating_proposals where status = 'pending';
select count(*) from public.rating_history where source = 'migration';
```

Expected after backfill: rows > 0 on staging; `backfill_source = 'cc02-pick-vn-backfill'`.

---

## 4. Behavioral verification

| Check | Flag off | Flag on |
|-------|----------|---------|
| Public skill after match | Changes (legacy) | **Unchanged** |
| competitionElo after match | N/A | Updates |
| BYE match | Legacy may update | **Skipped** |
| Daily play | Skipped | Skipped |
| Monthly review | Legacy direct compare | Mapped compare + gates |

---

## 5. Baseline comparison

| Metric | CC-01 baseline | After CC-02 |
|--------|----------------|-------------|
| Total tests | 1191 | 1213 (+22) |
| Pass | 1183 | 1205 (+22) |
| Fail | 8 | **8** (unchanged) |
| Build | Pass | Pass |
| ESLint (CC-02 files) | — | 0 errors |

**New regression from CC-02: 0**
