# CC-10 — Staging Environment Identification

| Item | Value |
|---|---|
| Staging Supabase project ref | `qyewbxjsiiyufanzcjcq` |
| Production Supabase | separate project (not used in CC-10) |
| Vercel | Preview/staging deployments per branch (not deployed CC-10) |
| Branch for staging | `feature/competition-core-standardization` |
| Env source | Vercel Preview env / `.env.staging-qa.local` (local QA only) |
| Production credentials in CC-10 | **NOT USED** |

## CC-10 staging actions

| Action | Status |
|---|---|
| Staging identified | PASS |
| Staging flags changed | **NOT CHANGED** |
| Staging deploy | **NOT DEPLOYED** |
| Staging shadow live test | **NOT RUN** (requires Stage 1 owner GO + flag apply) |

CC-10 completes static readiness. Live staging shadow deferred to rollout Stage 1.
