# V5-B.1E — Edge Function Deployment Runbook (Staging Only)

**Project ref:** `qyewbxjsiiyufanzcjcq`  
**Function:** `rating-v5-complete-assessment`  
**Freeze:** `v5.0f`

---

## 1. Pre-deploy checklist

```bash
node scripts/predeploy-v5b1e-check.mjs
node scripts/inspect-rating-v5-edge-bundle.mjs
```

Confirm:

| Field | Expected |
|-------|----------|
| QUESTION BANK CHECKSUM | `e69cc1ea14abc9fb771684be3dfb056ad35595b0a1cefabd31c58f4b7264f37f` |
| GLOSSARY CHECKSUM | `686cacd6fb2817bda2b750c1ef14526047e5c232351faa8be6fa65a15375049f` |
| SCORING CONFIG CHECKSUM | `74729b36a17d331922b1dda734a8b7d025f19a9bfeb348807c51ba8cdcef6da1` |

**Do not deploy** if checksums differ without version bump.

Evidence: `docs/v5/rating-v5/qa-evidence/v5-b1e-edge/PREDEPLOY_RECORD.json`

---

## 2. Deploy (staging)

Set personal access token (same PAT used for Cursor MCP staging):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
node scripts/deploy-v5b1e-edge-staging.mjs
```

Alternative (CLI):

```bash
npx supabase functions deploy rating-v5-complete-assessment --project-ref qyewbxjsiiyufanzcjcq --use-api
```

Function URL after deploy:

```text
https://qyewbxjsiiyufanzcjcq.supabase.co/functions/v1/rating-v5-complete-assessment
```

Evidence: `docs/v5/rating-v5/qa-evidence/v5-b1e-edge/DEPLOY_RECORD.json`

### Secrets (auto-injected by Supabase)

| Secret | Source |
|--------|--------|
| `SUPABASE_URL` | Platform |
| `SUPABASE_ANON_KEY` | Platform |
| `SUPABASE_SERVICE_ROLE_KEY` | Platform |

Optional:

| Env | Purpose |
|-----|---------|
| `RATING_V5_CORS_ORIGINS` | Comma-separated allowed origins (default: staging + localhost) |

**Never** use `VITE_*` in Edge Function. **Never** commit service role key.

---

## 3. Verify HTTP end-to-end

```bash
node scripts/verify-v5b1e-edge-http-staging.mjs
```

Pass criteria:

```text
HTTP END-TO-END TESTS: 25/25 PASS (minimum)
GOLDEN VECTOR MISMATCHES: 0
CROSS-TENANT LEAKS: 0
DUPLICATE EVENTS: 0
PARTIAL WRITES: 0
V2 MUTATIONS: 0
SECRET EXPOSURES: 0
```

Evidence: `docs/v5/rating-v5/qa-evidence/v5-b1e-edge/HTTP_E2E_REPORT.json`

---

## 4. Rollback function

Disable traffic by deleting function (staging only):

```bash
npx supabase functions delete rating-v5-complete-assessment --project-ref qyewbxjsiiyufanzcjcq
```

Or redeploy previous bundle from git tag.

Persistence RPC `rating_v5_service_persist_assessment_completion` remains; only HTTP entry is removed.

---

## 5. Rotate secrets

1. Rotate Supabase service role key in Dashboard → Settings → API.
2. Redeploy function (secrets re-bound automatically).
3. Re-run `node scripts/verify-v5b1e-edge-http-staging.mjs`.

---

## 6. V2 isolation check

After any deploy/verify:

```bash
node scripts/verify-v5a3-jwt-rls-staging.mjs
```

Confirm `pick_vn_player_ratings` unchanged.

---

## 7. Staging fault injection (test only)

Header `x-rating-v5-staging-fault` honored only when `SUPABASE_URL` contains `qyewbxjsiiyufanzcjcq`.

Values:

```text
after_scoring
after_assessment_update
before_event_insert
after_event_insert
before_profile_upsert
```

Not available in Production. Not available to ordinary users without staging URL.

---

## 8. Production guard

**Do not** deploy this function to production in V5-B.1E.
