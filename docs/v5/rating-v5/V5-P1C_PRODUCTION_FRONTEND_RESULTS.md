# V5-P1C.7 — Production Frontend Enable Results

**Gate:** P1-C.7 — ENABLE PRODUCTION FRONTEND AND ACTIVATE WAVE A  
**Date:** 2026-07-14  
**Owner GO:** `PRODUCTION_P1C_FRONTEND_GO=YES`  
**Production project:** `expuvcohlcjzvrrauvud`  
**Production domain:** `https://pickleball-scheduler-eight.vercel.app`

## Precheck

| Check | Result |
|-------|--------|
| Branch | `feature/rating-v5-production-wave-a` |
| Deploy Git SHA | `add62869e558fc65ac9a08fdea32cea896a1e857` (clean worktree; dirty TT9 WIP excluded) |
| Active Wave A enrollments | **5** |
| DB rollout | `allow_v5_assessment=true`, cohort `club-rating-v5-production-wave-a` |
| Edge CORS allow-origin | `https://pickleball-scheduler-eight.vercel.app` only (evil origin → null) |
| V2 rows | **0** |
| Rating events before | **0** |

Evidence: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-52-35-546Z-p1c7-pre/`

## Vercel Production env (set/updated)

| Variable | Action |
|----------|--------|
| `VITE_PICK_VN_RATING_V5_ENABLED` | set `true` |
| `VITE_SUPABASE_URL` | set Production URL (`expuvcohlcjzvrrauvud`) |
| `VITE_SUPABASE_ANON_KEY` | set Production anon (value hidden) |

No Staging values used. Preview env not modified.

## Production deployment

| Field | Value |
|-------|-------|
| Deployment ID | `dpl_G7djdS9ay5YWeRzda6mmXS4BhkLW` |
| Ready URL | `https://pickleball-scheduler-iswjq978t-pickleball-scheduler.vercel.app` |
| Aliased | **`https://pickleball-scheduler-eight.vercel.app`** |
| ReadyState | READY |
| Git SHA | `add6286` |
| Edge / SQL | **unchanged** |

## Remediation during gate (required for frontend SOT)

`rating_v5_get_my_pilot_enrollment` matches `tenant_id` via `rating_v5_resolve_tenant_id()` (from `profiles.venue_id`). Four Wave A profiles had `venue_id=null` → resolved `platform` → `PILOT_NOT_ENROLLED` in UI despite active enrollments at `venue-prod-main`.

Updated (Production profiles only, Wave A users with null venue):

- set `profiles.venue_id = venue-prod-main` for WA-01, WA-03, WA-04, WA-05  
- WA-02 already had `venue-prod-main`

Re-verified: **5/5** `rating_v5_get_my_pilot_enrollment` → `ok:true`.

## Explicit non-actions

- No Edge Function redeploy  
- No SQL schema migration  
- No enroll beyond 5  
- No V2 writes  
- Kill-switch **not** triggered (smoke PASS)

---

```text
FRONTEND FLAG ENABLED: PASS
PRODUCTION DEPLOYMENT: PASS
```
