# V5-P1-B — Production Smoke Results

**Gate:** P1-B — flag OFF, no enrollment  
**Date:** 2026-07-13  
**Production ref:** `expuvcohlcjzvrrauvud`  
**Production app:** `https://pickleball-scheduler-eight.vercel.app`

## Verdict

```text
PRODUCTION SMOKE: PASS (16/16)
V2 ISOLATION: PASS
```

## Execution

```bash
node scripts/verify-v5p1b-production-smoke-flag-off.mjs
```

Evidence: `qa-evidence/v5-p1b-smoke/LATEST_SMOKE_REPORT.json`

## Smoke matrix

| # | Test | Result | Detail |
|---|------|--------|--------|
| 1 | Project identity (URL) | PASS | `expuvcohlcjzvrrauvud` |
| 2 | Project identity (Edge) | PASS | `expuvcohlcjzvrrauvud` |
| 3 | Kill switch | PASS | `allow_v5_assessment=false` |
| 4 | No enrollments | PASS | 0 active |
| 5 | Edge health (OPTIONS) | PASS | 204 |
| 6 | CORS allowed origin | PASS | Production Vercel domain |
| 7 | CORS denied origin | PASS | 403 |
| 8 | JWT — no header | PASS | 401 |
| 9 | JWT — bad token | PASS | 401 |
| 10 | JWT — probe user | PASS | `player@gmail.com` |
| 11 | Edge non-enrolled block | PASS | 404 / assessment gate |
| 12 | RPC pilot gate | PASS | `ROLLOUT_BLOCKED` (kill switch) |
| 13 | RLS anon assessments | PASS | permission denied |
| 14 | Version stamping | PASS | `club-rating-v5-production-pilot` |
| 15 | No duplicate events | PASS | events=0 |
| 16 | V2 isolation | PASS | unchanged=0 |

## Safety counters

| Counter | Value |
|---------|-------|
| V2 mutations | 0 |
| Duplicate events | 0 |
| Partial writes | 0 |
| Staging requests from Production smoke | 0 |

## Flag state (unchanged)

```text
VITE_PICK_VN_RATING_V5_ENABLED=false  (not modified in P1-B)
allow_v5_assessment=false               (DB rollout config)
```

## Staging proxy (pre-Production reference)

| Suite | Result |
|-------|--------|
| V5-B1E Edge HTTP | 43/43 PASS |
| V5-C.1C non-enrolled block | PASS |
