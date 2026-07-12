# V5 — Test Plan

## Phase V5-A (this delivery)

### Unit tests

| Suite | File | Coverage |
|-------|------|----------|
| Scale & versions | `pick-vn-rating-v5-foundation.test.js` | 1.5–6.0 clamp, display round, version bundle |
| Security guard | `pick-vn-rating-v5-security.test.js` | forbidden fields, strip, assessment/match validation |
| Assessment | `pick-vn-rating-v5-assessment.test.js` | 22 core count, scoring, gates, adaptive routing |
| Display resolver | foundation test | open/verified/provisional selection |
| Reliability | foundation test | components sum, no rating multiplication |

### Integration tests (V5-B wiring)

- [ ] RPC `rating_v5_complete_assessment` persists server-computed fields
- [ ] Adaptive flow 24–30 questions
- [ ] Profile read returns both singles/doubles

### RLS tests (after SQL apply to staging)

- [ ] Player cannot UPDATE `player_rating_profiles`
- [ ] Player cannot INSERT computed assessment fields
- [ ] Player cannot UPDATE `player_rating_events`
- [ ] Admin override RPC audit log entry

### Security tests

- [ ] PostgREST direct upsert with `verified_rating` → denied
- [ ] `pick_vn_sync_rating` hardened (legacy) — separate ticket

### Simulation tests (V5-G)

- [ ] 10,000 match simulation — convergence, inflation
- [ ] 30 persona benchmark — questionnaire MAE

## Commands

```bash
node --test tests/pick-vn-rating-v5-foundation.test.js
node --test tests/pick-vn-rating-v5-security.test.js
node --test tests/pick-vn-rating-v5-assessment.test.js
```

## Build / lint

```bash
npm run build
npm run lint
```
