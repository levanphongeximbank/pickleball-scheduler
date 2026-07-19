# 04 — Environment safeguards (Phase 1E)

## Hard rules

1. **Production apply is never automatic** from CI or this readiness package.
2. Preflight CLI requires **all** of:
   - `CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT=YES`
   - `PRODUCTION_SUPABASE_PROJECT_REF=expuvcohlcjzvrrauvud`
   - `SUPABASE_DB_URL` clearly targeting Production (project ref in URL **or** matched `PRODUCTION_DB_HOST_HINT`)
3. Fail-closed on missing/unexpected confirmation.
4. Refuse Staging ref `qyewbxjsiiyufanzcjcq` inside the Production preflight script.
5. Staging readonly script refuses Production ref.
6. Secrets stay in gitignored env files (`.env.production-qa.local`, etc.) — **never commit**.
7. No `service_role` key in browser/frontend Player Management code.
8. Forward apply, verify, and rollback remain **separate files**; rollback is not chained into normal apply.

## Expected references

| Env | Project ref |
|-----|-------------|
| Staging | `qyewbxjsiiyufanzcjcq` |
| Production | `expuvcohlcjzvrrauvud` |

## What this package will not do

- Auto-detect Production and apply SQL
- Fall back from Staging credentials to Production
- Embed service_role into client bundles
- Treat rollback as a default recovery step without Owner approval
