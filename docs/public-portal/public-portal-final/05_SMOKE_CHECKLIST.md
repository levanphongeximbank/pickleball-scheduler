# Production Smoke Checklist (Phase B — not run in Phase A)

Canonical domain: `https://pickleball-scheduler-eight.vercel.app`

| # | Check | Expected |
|---|-------|----------|
| 1 | `/clubs` HTTP | 200 |
| 2 | `/courts` HTTP | 200 |
| 3 | Clubs list state | LIVE with ≥1 card OR explicit EMPTY (not MIXED mock) |
| 4 | Courts list state | LIVE with ≥1 card OR explicit EMPTY (not MIXED mock) |
| 5 | Remote error | Fail-closed ERROR; no mock fallback |
| 6 | Error copy | No secrets / internal stack traces |
| 7 | Domain | Canonical Vercel Production alias |
| 8 | Deploy health | GitHub/Vercel Production deployment success |

Phase A: smoke URLs reachable (HTTP 200) with current local source — verified headers only.
