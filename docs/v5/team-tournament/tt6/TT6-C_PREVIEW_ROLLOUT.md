# TT-6C — Preview Rollout

**Production impact:** NONE

## Deploy target

Vercel Preview from branch `feature/tt6-realtime-sync` after regression PASS.

## Required env (Preview)

```
VITE_TT_REALTIME_ENABLED=true
```

Keep existing Staging Supabase vars (`VITE_SUPABASE_URL` → `qyewbxjsiiyufanzcjcq`).

## Production

Do **not** set `VITE_TT_REALTIME_ENABLED` on Production (remain false/unset).

## Verify

```bash
STAGING_PREVIEW_URL=https://... node scripts/verify-phase-tt6c-preview-smoke.mjs
```

Evidence: `docs/v5/qa-evidence/phase-tt6/TT6C_PREVIEW_REPORT.json`
