# V5-P1-B — Production Edge Results

**Gate:** P1-B  
**Date:** 2026-07-13  
**Function:** `rating-v5-complete-assessment`  
**Production ref:** `expuvcohlcjzvrrauvud`

## Verdict

```text
PRODUCTION EDGE: PASS
```

## Deploy record

| Field | Value |
|-------|-------|
| Function URL | `https://expuvcohlcjzvrrauvud.supabase.co/functions/v1/rating-v5-complete-assessment` |
| Deployed at | 2026-07-13T15:34:48Z (v3, CORS fix redeploy) |
| Bundle checksum (`edgeEntry.js`) | `f914ebb8f71645f302a78d5da761887f08446677a7fe7f5d962d5079738f1b64` |
| `verify_jwt` | `true` |
| Deployment ID | `0674df12-e3e5-4aa5-acb3-3b7bc9debb6e` |

Evidence: `qa-evidence/v5-p1b-edge/DEPLOY_RECORD.json`

## Secrets configured

```text
RATING_V5_CORS_ORIGINS=https://pickleball-scheduler-eight.vercel.app
```

Platform-injected: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## CORS fix (P1-B)

Initial deploy returned 403 on OPTIONS because the Deno wrapper did not pass `RATING_V5_CORS_ORIGINS` into `handleCompleteAssessmentHttpRequest`. Fixed in `supabase/functions/rating-v5-complete-assessment/index.ts` and redeployed (v3).

## Deploy commands

```bash
node scripts/bundle-rating-v5-edge-shared.mjs
node scripts/deploy-v5p1b-edge-production.mjs
```

## Rollback

```bash
npx supabase functions delete rating-v5-complete-assessment --project-ref expuvcohlcjzvrrauvud
```
