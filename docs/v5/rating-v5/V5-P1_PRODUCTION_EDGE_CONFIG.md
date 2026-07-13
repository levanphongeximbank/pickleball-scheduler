# V5-P1 — Production Edge Configuration (prepare only)

**Function:** `rating-v5-complete-assessment`  
**Deploy:** P1-B only (NOT executed in P1-A)

## Production project

| Setting | Value |
|---------|-------|
| Project ref | `expuvcohlcjzvrrauvud` |
| `SUPABASE_URL` | `https://expuvcohlcjzvrrauvud.supabase.co` |
| Service role | Platform-injected secret (never in frontend) |

## CORS — owner confirmed

| Item | Value |
|------|-------|
| **Production domain** | `https://pickleball-scheduler-eight.vercel.app` |
| **CORS status** | **CONFIRMED** (`PRODUCTION CORS READY: YES`) |
| Canonical allowlist | `V5-P1_PRODUCTION_CORS_ALLOWLIST.json` |
| Runtime env key | `RATING_V5_CORS_ORIGINS` |
| Code surface | `src/features/pick-vn-rating-v5/config/ratingV5EdgeCorsConfig.js` |

### Production Edge secret (P1-B deploy)

```text
RATING_V5_CORS_ORIGINS=https://pickleball-scheduler-eight.vercel.app
```

Single origin only. To change domain later: update `V5-P1_PRODUCTION_CORS_ALLOWLIST.json` + redeploy Edge with new env value.

### Explicitly excluded

```text
https://*.vercel.app
__vercel_preview__
__localhost_qa__
qyewbxjsiiyufanzcjcq (staging)
* (wildcard)
staging preview URLs
```

`buildCorsHeaders` no longer falls back to `*` — empty allowlist denies all cross-origin requests.

## Bundle requirements

| Requirement | Status |
|-------------|--------|
| Engine freeze v5.0f | PASS |
| 4-field payload allowlist | PASS |
| `rating_v5_assert_pilot_gate` before persist | PASS |
| Staging fault injection disabled on Production URL | PASS |
| CORS single-origin allowlist | PASS |
| Entry source | `src/features/pick-vn-rating-v5/server/edgeEntry.js` |

## Deploy command (P1-B — do not run in P1-A)

```bash
# After owner GO for P1-B
# Supabase Edge secrets:
#   RATING_V5_CORS_ORIGINS=https://pickleball-scheduler-eight.vercel.app
npx supabase functions deploy rating-v5-complete-assessment --project-ref expuvcohlcjzvrrauvud --use-api
```

## Post-deploy smoke (flag OFF)

- Non-enrolled user → `PILOT_NOT_ENROLLED`
- CORS from `https://pickleball-scheduler-eight.vercel.app` → allowed
- CORS from preview/localhost QA origins → denied

## Rollback

```bash
npx supabase functions delete rating-v5-complete-assessment --project-ref expuvcohlcjzvrrauvud
```

See `V5-P1_PRODUCTION_DISABLE_RUNBOOK.md`.
